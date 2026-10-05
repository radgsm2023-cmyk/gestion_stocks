/*
# Création du bucket de stockage pour les logos

## Description
Crée un bucket public `logos` dans Supabase Storage pour stocker les logos d'entreprise téléversés depuis la page Paramètres.

## Sécurité
- Bucket public en lecture (les logos doivent être visibles dans les documents imprimés).
- Upload limité aux utilisateurs authentifiés.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_logos" ON storage.objects;
CREATE POLICY "anon_read_logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "authenticated_upload_logos" ON storage.objects;
CREATE POLICY "authenticated_upload_logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "authenticated_update_logos" ON storage.objects;
CREATE POLICY "authenticated_update_logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "authenticated_delete_logos" ON storage.objects;
CREATE POLICY "authenticated_delete_logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos');
