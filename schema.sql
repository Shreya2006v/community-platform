-- Supabase Database Schema

-- 1. Create the `users` table
CREATE TABLE IF NOT EXISTS public.users (
    uid UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    photo_url TEXT,
    district TEXT,
    role TEXT DEFAULT 'user'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Create the `posts` table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(uid) NOT NULL,
    user_name TEXT NOT NULL,
    user_photo TEXT,
    district TEXT,
    content_type TEXT NOT NULL, -- 'text', 'image', 'video'
    text_content TEXT NOT NULL,
    file_url TEXT,
    status TEXT DEFAULT 'pending'::text, -- 'pending', 'approved', 'rejected'
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Storage setup instructions:
-- 1. Create a public storage bucket named 'uploads'
-- 2. Enable public read access to it
