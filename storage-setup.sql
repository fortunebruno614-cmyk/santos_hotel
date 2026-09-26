SELECT * FROM storage.buckets;

SELECT * FROM storage.objects;

SELECT * FROM storage.objects WHERE bucket_id = 'santos_hotel';

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'santos_hotel');

CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
USING (bucket_id = 'santos_hotel');

CREATE POLICY "Allow owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'santos_hotel' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'santos_hotel' AND auth.uid()::text = (storage.foldername(name))[1]);
