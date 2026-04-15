import { supabase } from './supabase-config.js'

let isReady = false
const CACHE_BUSTER = Date.now() // to force image reload if needed

document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure auth has loaded currentUser
    setTimeout(loadFeed, 500)
    setupUploadForm()
})

async function loadFeed() {
    const container = document.getElementById('feed-container')
    if (!container) return

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles ( name, avatar_url, district )
            `)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })

        if (error) throw error

        container.innerHTML = ''
        if (posts.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); padding: 2rem;">No posts yet. Be the first!</p>'
            return
        }

        posts.forEach(post => {
            const card = document.createElement('div')
            card.className = 'glass-panel post-card'
            
            let imgHTML = post.image_url ? 
                `<div class="post-media"><img src="${post.image_url}" loading="lazy"></div>` : ''

            card.innerHTML = `
                <div class="post-header">
                    <img src="${post.profiles?.avatar_url || 'https://via.placeholder.com/40'}" class="avatar">
                    <div class="post-user-info">
                        <span class="name">${post.profiles?.name || 'Unknown'}</span>
                        <span class="date">${new Date(post.created_at).toLocaleDateString()} &middot; ${post.profiles?.district || ''}</span>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                ${imgHTML}
            `
            container.appendChild(card)
        })

    } catch (error) {
        console.error('Feed Error:', error)
        container.innerHTML = '<p class="error">Failed to load feed.</p>'
    }
}

function setupUploadForm() {
    const fileInput = document.getElementById('post-file')
    const filePreview = document.getElementById('file-preview-img')
    const fileContainer = document.getElementById('file-preview-container')
    const fileNameDisplay = document.getElementById('file-name-display')
    const form = document.getElementById('upload-form')
    const submitBtn = document.getElementById('submit-post-btn')

    if (!form) return

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (file) {
            fileNameDisplay.textContent = file.name
            filePreview.src = URL.createObjectURL(file)
            fileContainer.classList.remove('hidden')
        } else {
            fileContainer.classList.add('hidden')
            fileNameDisplay.textContent = ''
        }
    })

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        submitBtn.disabled = true
        submitBtn.textContent = 'Posting...'

        const content = document.getElementById('post-content').value
        const file = fileInput.files[0]
        let imageUrl = null

        try {
            // Get user session right now
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not logged in')
            
            // Upload File
            if (file) {
                submitBtn.textContent = 'Uploading Image...'
                const fileExt = file.name.split('.').pop()
                const fileName = `${session.user.id}/${Date.now()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('connecty_uploads')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data: urlData } = supabase.storage
                    .from('connecty_uploads')
                    .getPublicUrl(fileName)
                    
                imageUrl = urlData.publicUrl
            }

            // Insert Post
            submitBtn.textContent = 'Wrapping up...'
            const { error: insertError } = await supabase
                .from('posts')
                .insert([{
                    author_id: session.user.id,
                    content: content,
                    image_url: imageUrl,
                    status: 'pending' // Admin must approve
                }])

            if (insertError) throw insertError

            alert('Awesome! Your post has been sent to moderation.')
            form.reset()
            fileContainer.classList.add('hidden')
            fileNameDisplay.textContent = ''
            
        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Post Update'
        }
    })
}
