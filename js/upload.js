import { supabase } from './supabase-config.js'

let currentUser = null
let userData = null

console.log('📤 Upload.js loaded')

// ========================================
// WAIT FOR SESSION FIRST - THEN RUN APP
// ========================================

async function initDashboard() {
    console.log('🔍 Checking session...')

    // Get the current session directly (don't wait for event)
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
        console.error('❌ Session error:', error)
        window.location.href = 'index.html'
        return
    }

    if (!session || !session.user) {
        console.log('❌ No session found, redirecting to login')
        window.location.href = 'index.html'
        return
    }

    // Session found!
    currentUser = session.user
    console.log('✅ Session found:', currentUser.email)

    // Get user data from database
    const { data, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', currentUser.id)
        .single()

    if (userError || !data) {
        console.log('⚠️ User not in database, redirecting to homepage')
        window.location.href = 'index.html'
        return
    }

    userData = data
    console.log('✅ User data loaded:', userData.name)

    // Update navbar
    const userPhotoNav = document.getElementById('user-photo-nav')
    const userNameNav = document.getElementById('user-name-nav')

    if (userPhotoNav) userPhotoNav.src = userData.photo_url || 'https://via.placeholder.com/40'
    if (userNameNav) userNameNav.textContent = userData.name

    // Load posts
    loadMyPosts()
}

// Run immediately when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initDashboard()
})


// ========================================
// LOGOUT
// ========================================

const logoutBtn = document.getElementById('logout-btn')
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        console.log('🚪 Logging out...')
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

// ========================================
// UPLOAD FORM
// ========================================

const uploadForm = document.getElementById('upload-form')
const contentType = document.getElementById('content-type')
const fileInput = document.getElementById('file-input')
const fileUploadSection = document.getElementById('file-upload-section')
const filePreview = document.getElementById('file-preview')
const uploadProgress = document.getElementById('upload-progress')

// Show/hide file section based on content type
if (contentType) {
    contentType.addEventListener('change', () => {
        const type = contentType.value

        if (type === 'text') {
            fileUploadSection.style.display = 'none'
            fileInput.required = false
        } else {
            fileUploadSection.style.display = 'block'
            fileInput.required = true

            if (type === 'image') fileInput.accept = 'image/*'
            else if (type === 'video') fileInput.accept = 'video/*'
        }

        filePreview.innerHTML = ''
        if (uploadProgress) uploadProgress.style.display = 'none'
    })
}

// Show file preview
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Max 50MB
        if (file.size > 50 * 1024 * 1024) {
            alert('❌ File too large! Max 50MB')
            fileInput.value = ''
            return
        }

        console.log('📁 File selected:', file.name)

        const reader = new FileReader()
        reader.onload = (e) => {
            const type = contentType.value
            if (type === 'image') {
                filePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%; max-height:400px; border-radius:10px;">`
            } else if (type === 'video') {
                filePreview.innerHTML = `<video controls style="max-width:100%; max-height:400px; border-radius:10px;"><source src="${e.target.result}"></video>`
            }
        }
        reader.readAsDataURL(file)
    })
}

// Handle form submit
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault()

        // Double check user is loaded
        if (!currentUser || !userData) {
            // Try to reload user data
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                alert('❌ You are not logged in. Please login again.')
                window.location.href = 'index.html'
                return
            }
            currentUser = session.user
        }

        const submitBtn = uploadForm.querySelector('button[type="submit"]')
        submitBtn.disabled = true
        submitBtn.textContent = '⏳ Uploading...'

        try {
            const type = contentType.value
            const textContent = document.getElementById('text-content').value
            const file = fileInput ? fileInput.files[0] : null

            console.log('📤 Submitting post:', { type, hasFile: !!file })

            let fileUrl = null

            // Upload file to Supabase Storage if exists
            if (file) {
                if (uploadProgress) uploadProgress.style.display = 'block'

                const fileExt = file.name.split('.').pop()
                const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`

                console.log('☁️ Uploading file:', fileName)

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('uploads')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false })

                if (uploadError) throw uploadError

                const { data: urlData } = supabase.storage
                    .from('uploads')
                    .getPublicUrl(fileName)

                fileUrl = urlData.publicUrl
                console.log('✅ File uploaded, URL:', fileUrl)

                if (uploadProgress) uploadProgress.style.display = 'none'
            }

            // Save post to database
            const { error: insertError } = await supabase
                .from('posts')
                .insert([{
                    user_id: currentUser.id,
                    user_name: userData.name,
                    user_photo: userData.photo_url,
                    district: userData.district,
                    content_type: type,
                    text_content: textContent,
                    file_url: fileUrl,
                    status: 'pending'
                }])

            if (insertError) throw insertError

            console.log('✅ Post saved successfully!')
            alert('✅ Content submitted! Waiting for admin approval.')

            // Reset form
            uploadForm.reset()
            if (filePreview) filePreview.innerHTML = ''
            if (fileUploadSection) fileUploadSection.style.display = 'none'

            loadMyPosts()

        } catch (error) {
            console.error('❌ Error submitting post:', error)
            alert('❌ Upload failed: ' + error.message)
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = '📤 Submit for Review'
            if (uploadProgress) uploadProgress.style.display = 'none'
        }
    })
}

// ========================================
// LOAD MY POSTS
// ========================================

async function loadMyPosts() {
    const container = document.getElementById('my-posts-container')
    if (!container || !currentUser) return

    container.innerHTML = '<div class="loading"></div>'
    console.log('📥 Loading my posts...')

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        console.log('✅ Loaded', posts?.length || 0, 'posts')

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">You haven\'t posted anything yet. Create your first post above! 👆</p>'
            return
        }

        container.innerHTML = ''
        posts.forEach(post => container.appendChild(createPostCard(post)))

    } catch (error) {
        console.error('❌ Error loading posts:', error)
        container.innerHTML = '<p style="text-align:center; color:red; padding:20px;">Error loading posts. Please refresh.</p>'
    }
}

// ========================================
// CREATE POST CARD
// ========================================

function createPostCard(post) {
    const div = document.createElement('div')
    div.className = 'post-card'

    const statusMap = {
        pending:  '<span class="status-badge status-pending">⏳ Pending Review</span>',
        approved: '<span class="status-badge status-approved">✅ Approved</span>',
        rejected: '<span class="status-badge status-rejected">❌ Rejected</span>'
    }

    let mediaHTML = ''
    if (post.file_url) {
        if (post.content_type === 'image') {
            mediaHTML = `<div class="post-media"><img src="${post.file_url}" alt="Post image"></div>`
        } else if (post.content_type === 'video') {
            mediaHTML = `<div class="post-media"><video controls><source src="${post.file_url}"></video></div>`
        }
    }

    const rejectionHTML = post.status === 'rejected' && post.rejection_reason
        ? `<div class="rejection-reason">❌ Reason: ${post.rejection_reason}</div>`
        : ''

    const date = new Date(post.created_at).toLocaleDateString()

    div.innerHTML = `
        <div class="post-header">
            <span class="post-date">${date}</span>
            ${statusMap[post.status] || ''}
        </div>
        <div class="post-content">${post.text_content}</div>
        ${mediaHTML}
        ${rejectionHTML}
    `

    return div
}

console.log('✅ Upload.js ready')
