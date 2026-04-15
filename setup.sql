-- CONNECTY SETUP: Drops all existing policies first, then recreates everything.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Approved posts are viewable by everyone." ON public.posts;
DROP POLICY IF EXISTS "Users can view their own pending/rejected posts." ON public.posts;
DROP POLICY IF EXISTS "Admin can view all posts." ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts." ON public.posts;
DROP POLICY IF EXISTS "Admin can update post status." ON public.posts;
DROP POLICY IF EXISTS "Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    district TEXT,
    role TEXT DEFAULT 'user'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- POSTS
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'pending'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved posts are viewable by everyone." ON public.posts FOR SELECT USING (status = 'approved');
CREATE POLICY "Users can view their own pending/rejected posts." ON public.posts FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Admin can view all posts." ON public.posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can insert their own posts." ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admin can update post status." ON public.posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('connecty_uploads', 'connecty_uploads', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'connecty_uploads');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'connecty_uploads' AND auth.role() = 'authenticated');
