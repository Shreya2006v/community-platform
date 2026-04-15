import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://qugzdpengggcrdywqbpc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z3pkcGVuZ2dnY3JkeXdxYnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODQzODksImV4cCI6MjA5MTY2MDM4OX0.3gbypVNu9qM-WwsqLY3cszWVY15uWIKEwJ5sEm7b1L8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signOut = async () => supabase.auth.signOut()

export const signInWithGoogle = async () =>
    supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/index.html' }
    })

// ── Profiles ──────────────────────────────────────────────────────────────────
export const getProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
    return { data, error }
}

export const setupProfile = async (userId, name, avatarUrl, district) => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert([{ id: userId, name, avatar_url: avatarUrl, district }])
    return { data, error }
}

// ── Posts (includes like counts + who liked) ──────────────────────────────────
export const getPosts = async (status = 'approved', district = null) => {
    let query = supabase.from('posts').select(`
        *,
        profiles:author_id (name, avatar_url, district),
        likes (user_id)
    `)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (data && district && district !== 'All') {
        return { data: data.filter(p => p.profiles?.district === district), error }
    }

    return { data, error }
}

export const createPost = async (authorId, content, imageUrl = null) => {
    const { data, error } = await supabase
        .from('posts')
        .insert([{ author_id: authorId, content, image_url: imageUrl, status: 'pending' }])
    return { data, error }
}

export const updatePostStatus = async (postId, status) => {
    const { data, error } = await supabase
        .from('posts').update({ status }).eq('id', postId)
    return { data, error }
}

// ── Likes ─────────────────────────────────────────────────────────────────────
export const toggleLike = async (postId, userId) => {
    // Use maybeSingle() — returns null (not error) when no row found
    const { data: existing } = await supabase
        .from('likes').select('id')
        .eq('post_id', postId).eq('user_id', userId)
        .maybeSingle()

    if (existing) {
        return supabase.from('likes').delete().eq('id', existing.id)
    } else {
        return supabase.from('likes').insert([{ post_id: postId, user_id: userId }])
    }
}

// ── Image Upload ──────────────────────────────────────────────────────────────
export const uploadImage = async (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
        return { url: null, error: { message: 'Only JPG, PNG, GIF, WebP images are allowed.' } }
    }
    if (file.size > 5 * 1024 * 1024) {
        return { url: null, error: { message: 'Image must be under 5MB.' } }
    }

    const ext = file.name.split('.').pop().toLowerCase()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from('connecty_uploads')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { url: null, error: uploadError }

    const { data: urlData } = supabase.storage
        .from('connecty_uploads').getPublicUrl(fileName)

    return { url: urlData.publicUrl, error: null }
}
