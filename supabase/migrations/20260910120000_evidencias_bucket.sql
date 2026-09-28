-- Storage bucket for ticket evidence ("Evidências" tab). The RLS policies that
-- guard it were created in 20260909190324_*.sql; this creates the bucket itself
-- so uploads/downloads in chamados.$id.tsx stop failing with "Bucket not found".
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidencias', 'evidencias', false, 26214400)
ON CONFLICT (id) DO NOTHING;
