import { supabase } from './supabase-config.js'

let currentUser = null
let userData = null

console.log('🛡️ Admin.js loaded')

// ========================================
// CHECK ADMIN ACCESS
// ========================================

async function initAdmin() {
    console.log('🔍 Checking admin access...')

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session || !session.user) {
        console.log('❌ No session, redirecting to login')
        alert('❌ Please login first')
        window.location.href = 'index.html'
        return
    }

    currentUser = session.user
    console.log('✅ Session found:', currentUser.email)

    // Get user data from database
    const { data, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('uid', currentUser.id)
    .single()


    if (userError || !data) {
        console.log('❌ User not found in database')
        alert('❌ User profile not found')
        window.location.href = 'index.html'
        return
    }

    userData = data
    console.log('👤 User loaded:', userData.name, 'Role:', userData.role)

    // Check if user is admin
    if (userData.role !== 'admin') {
        console.log('❌ Access denied - not admin')
        alert('❌ Access Denied! Admin only.')
        window.location.href = 'index.html'
        return
    }

    console.log('✅ Admin access confirmed!')

    // Update UI
    const adminName = document.getElementById('admin-name')
    if (adminName) adminName.textContent = userData.name

    // Load data
    loadPendingPosts()
    loadStats()
}

// Run on page load
initAdmin()

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
// LOAD PENDING POSTS
// ========================================

async function loadPendingPosts() {
    const container = document.getElementById('pending-posts')
    if (!container) {
        console.log('⚠️ Pending posts container not found')
        return
    }

    container.innerHTML = '<div class="loading"></div>'
    console.log('📥 Loading pending posts...')

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('❌ Error loading posts:', error)
            throw error
        }

        console.log('✅ Found', posts?.length || 0, 'pending posts')

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 60px; font-size: 1.2em;">✅ No pending posts! All caught up.</p>'
            return
        }

        container.innerHTML = ''

        posts.forEach(post => {
            const postCard = createAdminPostCard(post)
            container.appendChild(postCard)
        })

    } catch (error) {
        console.error('❌ Error loading posts:', error)
        container.innerHTML = '<p style="text-align: center; color: red; padding: 40px;">Error loading posts. Please refresh.</p>'
    }
}

// ========================================
// CREATE ADMIN POST CARD
// ========================================

function createAdminPostCard(post) {
    const div = document.createElement('div')
    div.className = 'admin-post-card'

    let mediaHTML = ''
    if (post.file_url) {
        if (post.content_type === 'image') {
            mediaHTML = `<img src="${post.file_url}" style="max-width: 100%; max-height: 400px; border-radius: 10px; margin: 15px 0;" alt="Post image">`
        } else if (post.content_type === 'video') {
            mediaHTML = `<video controls style="max-width: 100%; max-height: 400px; border-radius: 10px; margin: 15px 0;"><source src="${post.file_url}"></video>`
        }
    }

    const date = new Date(post.created_at).toLocaleString()

    div.innerHTML = `
        <div class="admin-post-header">
            <div class="post-info">
                <strong>${post.user_name}</strong> from <span style="color: #667eea;">${post.district}</span><br>
                <small style="color: #999;">📅 ${date}</small>
            </div>
        </div>
        
        <div class="post-content" style="margin: 20px 0; font-size: 1.1em; line-height: 1.6;">
            ${post.text_content}
        </div>
        
        ${mediaHTML}
        
        <div class="admin-actions">
            <button class="btn-approve" data-id="${post.id}">✅ Approve & Publish</button>
            <button class="btn-reject" data-id="${post.id}">❌ Reject</button>
        </div>
    `

    // Add event listeners
    const approveBtn = div.querySelector('.btn-approve')
    const rejectBtn = div.querySelector('.btn-reject')

    approveBtn.addEventListener('click', () => approvePost(post.id))
    rejectBtn.addEventListener('click', () => rejectPost(post.id))

    return div
}

// ========================================
// APPROVE POST
// ========================================

async function approvePost(postId) {
    console.log('✅ Approving post:', postId)

    if (!confirm('✅ Approve this post and make it public?')) {
        return
    }

    try {
        const { error } = await supabase
            .from('posts')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: currentUser.id
            })
            .eq('id', postId)

        if (error) {
            console.error('❌ Error approving post:', error)
            throw error
        }

        console.log('✅ Post approved successfully!')
        alert('✅ Post approved and published!')

        // Reload lists
        loadPendingPosts()
        loadStats()

    } catch (error) {
        console.error('❌ Approval failed:', error)
        alert('❌ Failed to approve post: ' + error.message)
    }
}

// ========================================
// REJECT POST
// ========================================

async function rejectPost(postId) {
    console.log('❌ Rejecting post:', postId)

    const reason = prompt('Enter rejection reason (optional):')

    if (reason === null) {
        // User clicked cancel
        return
    }

    try {
        const { error } = await supabase
            .from('posts')
            .update({
                status: 'rejected',
                rejection_reason: reason || 'Content policy violation',
                rejected_at: new Date().toISOString(),
                rejected_by: currentUser.id
            })
            .eq('id', postId)

        if (error) {
            console.error('❌ Error rejecting post:', error)
            throw error
        }

        console.log('✅ Post rejected')
        alert('Post rejected.')

        // Reload lists
        loadPendingPosts()
        loadStats()

    } catch (error) {
        console.error('❌ Rejection failed:', error)
        alert('❌ Failed to reject post: ' + error.message)
    }
}

// ========================================
// LOAD STATS
// ========================================

async function loadStats() {
    console.log('📊 Loading stats...')

    try {
        // Count pending posts
        const { count: pendingCount, error: pendingError } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')

        if (pendingError) throw pendingError

        const pendingEl = document.getElementById('pending-count')
        if (pendingEl) pendingEl.textContent = pendingCount || 0

        console.log('📊 Pending posts:', pendingCount)

        // Count approved today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count: approvedCount, error: approvedError } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
            .gte('approved_at', today.toISOString())

        if (approvedError) throw approvedError

        const approvedEl = document.getElementById('approved-count')
        if (approvedEl) approvedEl.textContent = approvedCount || 0

        console.log('📊 Approved today:', approvedCount)

        // Count rejected today
        const { count: rejectedCount, error: rejectedError } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected')
            .gte('rejected_at', today.toISOString())

        if (rejectedError) throw rejectedError

        const rejectedEl = document.getElementById('rejected-count')
        if (rejectedEl) rejectedEl.textContent = rejectedCount || 0

        console.log('📊 Rejected today:', rejectedCount)

    } catch (error) {
        console.error('❌ Error loading stats:', error)
    }
}

console.log('✅ Admin.js ready')
