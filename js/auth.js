import { supabase } from './supabase-config.js'

let currentUser = null
let currentDistrict = 'all'

console.log('🔐 Auth.js loaded')

// ========================================
// GOOGLE SIGN-IN
// ========================================

const googleLoginBtn = document.getElementById('google-login-btn')
const heroLoginBtn = document.getElementById('hero-login-btn')
const logoutBtnNav = document.getElementById('logout-btn-nav')

async function signInWithGoogle() {
    console.log('🚀 Starting Google sign-in...')
    
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/index.html'
            }
        })
        
        if (error) throw error
        console.log('✅ OAuth initiated')
        
    } catch (error) {
        console.error('❌ Sign-in failed:', error)
        alert('❌ Sign-in failed: ' + error.message)
    }
}

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', (e) => {
        e.preventDefault()
        signInWithGoogle()
    })
}

if (heroLoginBtn) {
    heroLoginBtn.addEventListener('click', (e) => {
        e.preventDefault()
        signInWithGoogle()
    })
}

if (logoutBtnNav) {
    logoutBtnNav.addEventListener('click', async (e) => {
        e.preventDefault()
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

const switchAccountBtn = document.getElementById('switch-account-btn')
if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', async () => {
        console.log('🔄 Switching account...')
        
        try {
            // 1️⃣ Sign out from Supabase
            await supabase.auth.signOut()
            
            // 2️⃣ Clear storage completely
            localStorage.clear()
            sessionStorage.clear()
            
            // 3️⃣ Redirect to Google logout, which will clear Google session
            window.location.href = 'https://accounts.google.com/Logout'
            
        } catch (err) {
            console.error('❌ Switch error:', err)
        }
    })
}

// ========================================
// AUTH STATE LISTENER
// ========================================

let isProcessing = false

supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth event:', event, session?.user?.email || 'No user')
    
    // Prevent processing the same event multiple times
    if (isProcessing) {
        console.log('⏸️ Already processing, skipping...')
        return
    }
    
    if (event === 'SIGNED_IN' && session?.user) {
        isProcessing = true
        currentUser = session.user
        console.log('✅ User signed in:', currentUser.email)
        
        try {
            // Check if user exists in database
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('uid', currentUser.id)
                .single()
            
            if (error && error.code === 'PGRST116') {
                // User doesn't exist - NEW USER
                console.log('🆕 NEW USER detected')
                
                // Make sure we're on homepage
                const currentPath = window.location.pathname
                console.log('📍 Current path:', currentPath)
                
                if (currentPath.includes('dashboard.html') || currentPath.includes('admin.html')) {
                    console.log('🔄 Wrong page, redirecting to homepage for district selection')
                    window.location.href = 'index.html'
                    return
                }
                
                // We're on homepage - show modal
                console.log('✅ On homepage, showing district modal')
                setTimeout(() => showDistrictModal(), 500) // Small delay to ensure DOM is ready
                
            } else if (userData) {
                // EXISTING USER
                console.log('✅ Existing user:', userData.name, '| Role:', userData.role)
                
                const currentPath = window.location.pathname
                
                // Check if on homepage
                if (currentPath.includes('index.html') || currentPath === '/' || currentPath === '') {
                    console.log('📍 On homepage, user already has account')
                    
                    // REDIRECT ADMINS TO ADMIN PANEL
                    if (userData.role === 'admin') {
                        console.log('👑 Admin detected, redirecting to admin panel')
                        window.location.href = 'admin.html'
                    } else {
                        // Regular users redirect to dashboard
                        console.log('👤 Regular user, redirecting to dashboard')
                        window.location.href = 'dashboard.html'
                    }
                } else {
                    // On dashboard or admin - just update navbar
                    updateNavbar(userData)
                }
            } else {
                throw new Error('Unexpected database response')
            }
            
        } catch (error) {
            console.error('❌ Error checking user:', error)
            alert('Error loading profile: ' + error.message)
        } finally {
            isProcessing = false
        }
        
    } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out')
        currentUser = null
        isProcessing = false
        
        const userInfo = document.getElementById('user-info')
        const googleLoginBtn = document.getElementById('google-login-btn')
        
        if (userInfo && googleLoginBtn) {
            userInfo.style.display = 'none'
            googleLoginBtn.style.display = 'flex'
        }
        
    } else if (event === 'INITIAL_SESSION') {
        console.log('📊 Initial session check')
        isProcessing = false
    }
})

// ========================================
// DISTRICT MODAL
// ========================================

function showDistrictModal() {
    console.log('🎯 showDistrictModal() called')
    
    const modal = document.getElementById('district-modal')
    
    if (!modal) {
        console.error('❌ Modal element not found!')
        console.log('Available elements:', document.body.innerHTML.substring(0, 200))
        alert('❌ Error: District modal not found. Are you on index.html?')
        return
    }
    
    const districtSelect = document.getElementById('district-select')
    const saveBtn = document.getElementById('save-district-btn')
    
    if (!districtSelect || !saveBtn) {
        console.error('❌ Modal elements missing!')
        return
    }
    
    console.log('✅ Showing modal')
    modal.style.display = 'flex'
    
    // Remove any existing onclick handlers
    saveBtn.onclick = null
    
    // Add new handler
    saveBtn.onclick = async () => {
        const district = districtSelect.value
        
        if (!district) {
            alert('⚠️ Please select a district')
            return
        }
        
        console.log('💾 Saving user:', currentUser.email, '| District:', district)
        
        saveBtn.disabled = true
        saveBtn.textContent = 'Saving...'
        
        try {
            const userName = currentUser.user_metadata?.full_name || 
                           currentUser.user_metadata?.name || 
                           currentUser.email?.split('@')[0] || 
                           'User'
            
            const userPhoto = currentUser.user_metadata?.avatar_url || 
                            currentUser.user_metadata?.picture || 
                            null
            
            console.log('👤 Inserting user:', {
                uid: currentUser.id,
                name: userName,
                email: currentUser.email,
                district: district
            })
            
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    uid: currentUser.id,
                    name: userName,
                    email: currentUser.email,
                    photo_url: userPhoto,
                    district: district,
                    role: 'user'
                }])
                .select()
            
            if (error) {
                console.error('❌ Insert error:', error)
                throw error
            }
            
            console.log('✅ User saved!', data)
            
            modal.style.display = 'none'
            alert('✅ Welcome! Redirecting to dashboard...')
            
            // Give time for alert to show
            setTimeout(() => {
                window.location.href = 'dashboard.html'
            }, 500)
            
        } catch (error) {
            console.error('❌ Save error:', error)
            alert('❌ Error: ' + error.message)
            saveBtn.disabled = false
            saveBtn.textContent = 'Continue'
        }
    }
}

// ========================================
// UPDATE NAVBAR
// ========================================

function updateNavbar(userData) {
    console.log('🎨 Updating navbar:', userData.name)
    
    const userInfo = document.getElementById('user-info')
    const userPhoto = document.getElementById('user-photo')
    const userNameNav = document.getElementById('user-name-nav')
    
    if (userInfo && userPhoto && userNameNav) {
        userPhoto.src = userData.photo_url || 'https://via.placeholder.com/40'
        userNameNav.textContent = userData.name
        userInfo.style.display = 'flex'
    }
    
    // Hide login buttons if they exist (on homepage)
    const googleLoginBtn = document.getElementById('google-login-btn')
    if (googleLoginBtn) {
        googleLoginBtn.style.display = 'none'
    }
    
    const heroLoginBtn = document.getElementById('hero-login-btn')
    if (heroLoginBtn) {
        heroLoginBtn.style.display = 'none'
    }
}

// ========================================
// LOAD POSTS
// ========================================

async function loadPosts() {
    const container = document.getElementById('posts-grid')
    if (!container) return
    
    container.innerHTML = '<div class="loading"></div>'
    console.log('📥 Loading approved posts | District:', currentDistrict)
    
    try {
        let query = supabase
            .from('posts')
            .select('*')
            .eq('status', 'approved')
            .order('approved_at', { ascending: false })
            .limit(20)
        
        if (currentDistrict !== 'all') {
            query = query.eq('district', currentDistrict)
        }
        
        const { data: posts, error } = await query
        if (error) throw error
        
        console.log('✅ Loaded', posts?.length || 0, 'posts')
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="no-posts">📭 No posts yet. Be the first to share!</p>'
            return
        }
        
        container.innerHTML = ''
        posts.forEach(post => container.appendChild(createPublicPostCard(post)))
        
    } catch (error) {
        console.error('❌ Error loading posts:', error)
        container.innerHTML = '<p class="no-posts">❌ Error loading posts</p>'
    }
}

function createPublicPostCard(post) {
    const div = document.createElement('div')
    div.className = 'public-post-card'
    
    let mediaHTML = ''
    if (post.file_url) {
        if (post.content_type === 'image') {
            mediaHTML = `<div class="public-post-media"><img src="${post.file_url}" loading="lazy"></div>`
        } else if (post.content_type === 'video') {
            mediaHTML = `<div class="public-post-media"><video controls><source src="${post.file_url}"></video></div>`
        }
    }
    
    const date = post.approved_at ? new Date(post.approved_at).toLocaleDateString() : 'Recently'
    
    div.innerHTML = `
        <div class="public-post-header">
            <strong>${post.user_name}</strong>
            <span class="district-tag">${post.district}</span>
        </div>
        <div class="public-post-content">${post.text_content}</div>
        ${mediaHTML}
        <div class="public-post-footer">${date}</div>
    `
    
    return div
}

// District filter
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentDistrict = e.target.dataset.district
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        e.target.classList.add('active')
        loadPosts()
    })
})

// Load posts on homepage
if (document.getElementById('posts-grid')) {
    console.log('📄 On homepage, loading posts')
    loadPosts()
}

console.log('✅ Auth.js ready')

