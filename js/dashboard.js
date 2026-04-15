import { supabase, signOut, getProfile, getPosts, createPost, toggleLike, uploadImage } from './supabase-client.js'

let sessionUser = null
let userProfile = null
let currentDistrict = 'All'
let selectedFile = null   // Holds the File object chosen by the user

// ── DOM refs ──────────────────────────────────────────────────────────────────
const postsContainer  = document.getElementById('posts-container')
const feedTitle       = document.getElementById('feed-title')
const createModal     = document.getElementById('create-modal')
const uploadArea      = document.getElementById('upload-area')
const fileInput       = document.getElementById('post-image-file')
const uploadPlaceholder = document.getElementById('upload-placeholder')
const uploadPreview   = document.getElementById('upload-preview')
const previewImg      = document.getElementById('preview-img')
const progressBar     = document.getElementById('upload-progress')
const progressFill    = document.getElementById('upload-progress-bar')

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // District filters (work for everyone)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
            e.currentTarget.classList.add('active')
            currentDistrict = e.currentTarget.dataset.district
            feedTitle.textContent = currentDistrict === 'All' ? 'Global Feed' : currentDistrict
            loadPosts()
        })
    })

    // Auth check (optional — posts load regardless)
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
        const { data: profile } = await getProfile(session.user.id)

        if (!profile || !profile.district) {
            window.location.replace('index.html')
            return
        }

        sessionUser = session.user
        userProfile = profile

        // Show logged-in state
        document.getElementById('nav-guest').classList.add('hidden')
        document.getElementById('nav-user').classList.remove('hidden')
        document.getElementById('nav-username').textContent = userProfile.name
        if (userProfile.avatar_url) {
            document.getElementById('nav-avatar').innerHTML =
                `<img src="${userProfile.avatar_url}" alt="Avatar"
                      style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        }
        if (userProfile.role === 'admin') {
            document.getElementById('admin-link').classList.remove('hidden')
        }

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await signOut()
            window.location.replace('index.html')
        })

        // Create post modal
        document.getElementById('create-post-btn').addEventListener('click', openModal)
        document.getElementById('cancel-post-btn').addEventListener('click', closeModal)
        document.getElementById('submit-post-btn').addEventListener('click', handleSubmitPost)

        // File upload events
        setupFileUpload()
    }

    // Load feed for everyone
    loadPosts()

    // Like button delegation (works for guests too — prompts sign-in)
    postsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.like-btn')
        if (btn) handleLike(btn)
    })
})

// ── Load Posts ────────────────────────────────────────────────────────────────
async function loadPosts() {
    postsContainer.innerHTML = '<div class="text-center mt-8"><span class="spinner"></span></div>'

    const { data: posts, error } = await getPosts('approved', currentDistrict)

    if (error) {
        postsContainer.innerHTML = `
            <div class="glass glass-card text-center" style="padding:2rem;">
                <p style="color:var(--danger)">Failed to load posts: ${error.message}</p>
            </div>`
        return
    }

    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="glass glass-card text-center" style="padding:3rem;">
                <p style="color:var(--text-muted); margin-bottom:1rem;">
                    No posts yet in ${currentDistrict === 'All' ? 'the community' : currentDistrict}. Be the first!
                </p>
                ${!sessionUser
                    ? `<a href="index.html" class="btn btn-primary">Sign In to Post</a>`
                    : ''}
            </div>`
        return
    }

    postsContainer.innerHTML = posts.map(post => renderPost(post)).join('')
}

function renderPost(post) {
    const likeCount = Array.isArray(post.likes) ? post.likes.length : 0
    const isLiked   = sessionUser
        ? post.likes?.some(l => l.user_id === sessionUser.id)
        : false
    const author = post.profiles?.name || 'Community Member'
    const date   = new Date(post.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    })

    return `
    <article class="glass glass-card">
        <div class="flex items-center gap-4 mb-4">
            <div class="avatar">
                ${post.profiles?.avatar_url
                    ? `<img src="${post.profiles.avatar_url}" alt="${author}"
                            style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                    : `<div style="width:100%;height:100%;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.1rem;color:#fff;">
                           ${author[0].toUpperCase()}
                       </div>`}
            </div>
            <div>
                <h4 class="font-bold text-sm">${author}</h4>
                <span class="text-xs" style="color:var(--text-muted)">
                    ${date}${post.profiles?.district ? ' · ' + post.profiles.district : ''}
                </span>
            </div>
        </div>

        <div style="line-height:1.7; white-space:pre-wrap; margin-bottom:${post.image_url ? '1rem' : '0.75rem'}; color:var(--text-primary)">
            ${post.content}
        </div>

        ${post.image_url
            ? `<img src="${post.image_url}" alt="Post image"
                    style="width:100%; max-height:360px; object-fit:cover; border-radius:10px; margin-bottom:0.75rem;"
                    loading="lazy">`
            : ''}

        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:0.75rem; margin-top:0.25rem;">
            <button
                class="like-btn ${isLiked ? 'liked' : ''}"
                data-post-id="${post.id}"
                data-liked="${isLiked}"
                title="${sessionUser ? (isLiked ? 'Unlike' : 'Like') : 'Sign in to like'}"
            >
                ${isLiked ? '❤️' : '🤍'}
                <span class="like-count">${likeCount}</span>
                <span>${likeCount === 1 ? 'Like' : 'Likes'}</span>
            </button>
        </div>
    </article>`
}

// ── Like Handler (Optimistic UI) ──────────────────────────────────────────────
async function handleLike(btn) {
    if (!sessionUser) {
        // Prompt guest to sign in
        const go = confirm('Sign in to like posts. Go to sign in page?')
        if (go) window.location.href = 'index.html'
        return
    }

    if (btn.disabled) return
    btn.disabled = true

    const postId    = btn.dataset.postId
    const wasLiked  = btn.dataset.liked === 'true'
    const countEl   = btn.querySelector('.like-count')
    const labelEl   = btn.querySelector('span:last-child')
    const currentN  = parseInt(countEl.textContent, 10)
    const newN      = wasLiked ? currentN - 1 : currentN + 1

    // Optimistic update — instant feedback
    btn.dataset.liked = String(!wasLiked)
    btn.classList.toggle('liked', !wasLiked)
    btn.innerHTML = `${!wasLiked ? '❤️' : '🤍'} <span class="like-count">${newN}</span> <span>${newN === 1 ? 'Like' : 'Likes'}</span>`

    const { error } = await toggleLike(postId, sessionUser.id)

    if (error) {
        // Revert on failure
        btn.dataset.liked = String(wasLiked)
        btn.classList.toggle('liked', wasLiked)
        btn.innerHTML = `${wasLiked ? '❤️' : '🤍'} <span class="like-count">${currentN}</span> <span>${currentN === 1 ? 'Like' : 'Likes'}</span>`
        console.error('Like error:', error)
    }

    btn.disabled = false
}

// ── Create Post ───────────────────────────────────────────────────────────────
function openModal() {
    createModal.classList.add('active')
}

function closeModal() {
    createModal.classList.remove('active')
    document.getElementById('post-content').value = ''
    clearFileSelection()
}

async function handleSubmitPost() {
    const text = document.getElementById('post-content').value.trim()
    if (!text) {
        document.getElementById('post-content').focus()
        return
    }

    const submitBtn = document.getElementById('submit-post-btn')
    submitBtn.disabled = true
    submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Posting...'

    let imageUrl = null

    // Upload image if one was selected
    if (selectedFile) {
        progressBar.style.display = 'block'
        progressFill.style.width = '30%'

        const { url, error: uploadErr } = await uploadImage(selectedFile)
        progressFill.style.width = '100%'

        if (uploadErr) {
            alert('Image upload failed: ' + uploadErr.message)
            submitBtn.disabled = false
            submitBtn.innerHTML = 'Post'
            progressBar.style.display = 'none'
            return
        }
        imageUrl = url
    }

    const { error } = await createPost(sessionUser.id, text, imageUrl)

    submitBtn.disabled = false
    submitBtn.innerHTML = 'Post'
    progressBar.style.display = 'none'
    progressFill.style.width = '0%'

    if (error) {
        alert('Error creating post: ' + error.message)
    } else {
        closeModal()
        showToast('✅ Post submitted for review! It will appear once approved.')
    }
}

// ── File Upload UI ────────────────────────────────────────────────────────────
function setupFileUpload() {
    // Click on upload area triggers file input
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== document.getElementById('remove-img-btn')) {
            fileInput.click()
        }
    })

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleFileSelected(fileInput.files[0])
    })

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        uploadArea.classList.add('drag-over')
    })
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'))
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadArea.classList.remove('drag-over')
        if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0])
    })

    document.getElementById('remove-img-btn').addEventListener('click', (e) => {
        e.stopPropagation()
        clearFileSelection()
    })
}

function handleFileSelected(file) {
    if (file.size > 5 * 1024 * 1024) {
        alert('Image must be under 5MB.')
        return
    }
    selectedFile = file
    const reader = new FileReader()
    reader.onload = (e) => {
        previewImg.src = e.target.result
        uploadPlaceholder.style.display = 'none'
        uploadPreview.style.display = 'block'
        uploadArea.style.borderColor = 'var(--primary)'
    }
    reader.readAsDataURL(file)
}

function clearFileSelection() {
    selectedFile = null
    fileInput.value = ''
    previewImg.src = ''
    uploadPlaceholder.style.display = 'block'
    uploadPreview.style.display = 'none'
    uploadArea.style.borderColor = ''
}

// ── Toast Notification ────────────────────────────────────────────────────────
function showToast(message) {
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = `
        position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
        background: var(--surface); border: 1px solid var(--border-light);
        color: var(--text-primary); padding: 0.85rem 1.5rem; border-radius: 12px;
        font-size: 0.9rem; z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        animation: slideUp 0.3s ease;
    `
    const style = document.createElement('style')
    style.textContent = `@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(1rem) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`
    document.head.appendChild(style)
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
}
