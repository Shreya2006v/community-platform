import { supabase, signInWithGoogle, getProfile, setupProfile } from './supabase-client.js'

const heroBtn = document.getElementById('hero-login-btn')
const navBtn = document.getElementById('nav-login-btn')
const heroSection = document.getElementById('hero-section')
const districtModal = document.getElementById('district-modal')

let isHandled = false  // Prevent duplicate auth handling

document.addEventListener('DOMContentLoaded', () => {
    // Login buttons
    const handleLogin = async (e) => {
        const btn = e.currentTarget
        const originalHTML = btn.innerHTML
        btn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border-width:2px;"></span> Connecting...'
        btn.disabled = true

        const { error } = await signInWithGoogle()
        if (error) {
            alert(error.message)
            btn.innerHTML = originalHTML
            btn.disabled = false
        }
        // On success, Google redirects to index.html — browser navigates away
    }

    if (heroBtn) heroBtn.addEventListener('click', handleLogin)
    if (navBtn) navBtn.addEventListener('click', handleLogin)

    // Auth state handler — index.html is the SINGLE routing authority
    // After OAuth, Supabase redirects back to index.html with the code,
    // exchanges it here, then fires SIGNED_IN with a valid session.
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (isHandled) return

        // Only act when we have a definitive auth state
        if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return

        if (!session) return  // No session — stay on index, show the hero

        // We have a valid session — prevent this from firing again
        isHandled = true

        const { data: profile, error: profileError } = await getProfile(session.user.id)

        // DEBUG: Remove these logs once routing works
        console.log('[AUTH] Event:', event)
        console.log('[AUTH] Profile from DB:', profile)
        console.log('[AUTH] Profile error:', profileError)
        console.log('[AUTH] Role:', profile?.role)

        if (!profile || !profile.district) {
            // First-time user — show district onboarding modal
            showSetupModal(session.user)
        } else {
            // Returning user — route to the correct page
            if (profile.role === 'admin') {
                console.log('[AUTH] Routing to admin.html')
                window.location.replace('admin.html')
            } else {
                console.log('[AUTH] Routing to dashboard.html')
                window.location.replace('dashboard.html')
            }
        }
    })
})

function showSetupModal(user) {
    if (heroSection) heroSection.classList.add('hidden')
    if (districtModal) districtModal.classList.remove('hidden')

    const name = user.user_metadata?.full_name || 'User'
    const avatar = user.user_metadata?.avatar_url || ''

    const setupName = document.getElementById('setup-name')
    const setupAvatar = document.getElementById('setup-avatar')
    if (setupName) setupName.textContent = name
    if (setupAvatar && avatar) {
        setupAvatar.innerHTML = `<img src="${avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
    }

    const saveBtn = document.getElementById('save-district-btn')
    const selector = document.getElementById('district-select')

    if (saveBtn && selector) {
        saveBtn.addEventListener('click', async () => {
            const district = selector.value
            if (!district) return alert('Please select a district first.')

            saveBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border-width:2px;"></span> Saving...'
            saveBtn.disabled = true

            const { error } = await setupProfile(user.id, name, avatar, district)

            if (error) {
                alert('Error saving profile: ' + error.message)
                saveBtn.innerHTML = 'Complete Profile'
                saveBtn.disabled = false
            } else {
                window.location.replace('dashboard.html')
            }
        })
    }
}
