-- Allow anonymous users to upload to documents bucket (for public KYC form)
CREATE POLICY "Anon users can upload KYC documents"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] IN ('kyc-photos', 'kyc-aadhar', 'kyc-idcards'));

-- Allow anonymous users to read their uploaded documents
CREATE POLICY "Anon users can view KYC documents"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] IN ('kyc-photos', 'kyc-aadhar', 'kyc-idcards'));
