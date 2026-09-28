CREATE POLICY "evidencias_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evidencias' AND public.can_view_ticket((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY "evidencias_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidencias' AND public.can_view_ticket((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY "evidencias_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'evidencias' AND owner = auth.uid());