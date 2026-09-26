-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, '{"image/png","image/jpeg","image/gif","image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Allow anyone to view avatars (public bucket)
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
