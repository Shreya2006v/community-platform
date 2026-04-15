import { supabase, signOut, getProfile, getPosts, updatePostStatus } from './supabase-client.js'

let currentStatus = 'pending'

document.addEventListener('DOMContentLoaded', async () => {
    // Use getSession() directly — reliable since all OAuth flows go through index.html first.
    // onAuthStateChange was causing redirect loops due to Supabase storage lock conflicts.
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        window.location.href = 'index.html'
        return
    }

    const { data: profile, error: profileError } = await getProfile(session.user.id)

    if (profileError || !profile) {
        console.error('[ADMIN] Could not load profile:', profileError)
        window.location.href = 'index.html'
        return
    }

    if (profile.role !== 'admin') {
        window.location.href = 'dashboard.html'
        return
    }

    // Setup navbar
    document.getElementById('nav-username').textContent = profile.name + ' (Admin)'
    if (profile.avatar_url) {
        document.getElementById('nav-avatar').innerHTML =
            `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await signOut()
        window.location.href = 'index.html'
    })

    document.querySelectorAll('.filter-admin').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-admin').forEach(b => b.classList.remove('active'))
            e.currentTarget.classList.add('active')
            currentStatus = e.currentTarget.dataset.status
            loadAdminPosts()
        })
    })

    loadAdminPosts()
})

window.changePostStatus = async (postId, newStatus) => {
    const { error } = await updatePostStatus(postId, newStatus)
    if (error) {
        alert('Failed to update: ' + error.message)
    } else {
        loadAdminPosts()
    }
}

async function loadAdminPosts() {
    const tableBody = document.getElementById('admin-table-body')
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem"><span class="spinner"></span></td></tr>`

    const { data: posts, error } = await getPosts('all')

    console.log('[ADMIN] posts:', posts, 'error:', error)

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);text-align:center;padding:1rem">
            ❌ Error loading posts: ${error.message}
        </td></tr>`
        return
    }

    const allPosts = Array.isArray(posts) ? posts : []

    if (allPosts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">
            No posts in the database yet. Create a post from the Dashboard first.
        </td></tr>`
        return
    }

    const filtered = allPosts.filter(p => p.status === currentStatus)

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">
            No <strong>${currentStatus}</strong> posts found.
        </td></tr>`
        return
    }

    tableBody.innerHTML = filtered.map(post => {
        const preview = post.content.length > 80 ? post.content.substring(0, 80) + '...' : post.content
        const date = new Date(post.created_at).toLocaleDateString()
        const author = post.profiles?.name || 'Unknown'

        let actions = ''
        if (currentStatus === 'pending') {
            actions = `
                <button class="btn btn-success" style="padding:0.25rem 0.75rem;font-size:0.8rem;"
                    onclick="changePostStatus('${post.id}', 'approved')">Approve</button>
                <button class="btn btn-danger" style="padding:0.25rem 0.75rem;font-size:0.8rem;margin-top:0.25rem;"
                    onclick="changePostStatus('${post.id}', 'rejected')">Reject</button>`
        } else if (currentStatus === 'rejected') {
            actions = `
                <button class="btn btn-success" style="padding:0.25rem 0.75rem;font-size:0.8rem;"
                    onclick="changePostStatus('${post.id}', 'approved')">Approve</button>`
        }

        return `
        <tr>
            <td>
                <div class="flex items-center gap-2">
                    <div class="avatar" style="width:32px;height:32px;">
                        ${post.profiles?.avatar_url
                            ? `<img src="${post.profiles.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                            : `<div style="width:100%;height:100%;background:var(--primary);border-radius:50%;"></div>`}
                    </div>
                    <div>
                        <div class="font-bold text-sm">${author}</div>
                        <div class="text-xs" style="color:var(--text-muted)">${post.profiles?.district || ''}</div>
                    </div>
                </div>
            </td>
            <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                title="${post.content.replace(/"/g, '&quot;')}">
                ${post.image_url ? '🖼️ ' : ''}${preview}
            </td>
            <td style="color:var(--text-secondary)">${date}</td>
            <td><div class="flex flex-col gap-1 items-start">${actions}</div></td>
        </tr>`
    }).join('')
}