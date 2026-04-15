-- LIKES TABLE: Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can see like counts
CREATE POLICY "Likes are viewable by everyone."
ON public.likes FOR SELECT USING (true);

-- Only authenticated users can like
CREATE POLICY "Authenticated users can like posts."
ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only remove their own likes
CREATE POLICY "Users can remove their own likes."
ON public.likes FOR DELETE USING (auth.uid() = user_id);
