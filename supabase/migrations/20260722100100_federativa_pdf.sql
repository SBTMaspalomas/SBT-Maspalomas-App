-- =============================================================================
-- FASE 4 · Ficha Federativa PDF (Módulo 4).
--
-- Añade a `registrations` el PDF de la Ficha Federativa Única y su estado en el
-- semáforo del validador. La familia/senior descarga la plantilla oficial, la
-- firma tras el reconocimiento médico y resube el PDF; el admin lo valida como
-- un documento más en ValidationConsole. ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- URL del PDF firmado subido a Storage (bucket player-docs) y su semáforo
-- (null = aún no aportado, 'pending' | 'approved' | 'rejected').
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS federativa_pdf_url text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS federativa_status text;

-- La familia sólo tenía políticas SELECT e INSERT sobre sus propios registros;
-- para poder adjuntar la ficha federativa necesita también UPDATE del suyo.
-- (El admin ya gestiona todo vía registrations_admin_all.)
DROP POLICY IF EXISTS "registrations_update_own" ON public.registrations;
CREATE POLICY "registrations_update_own"
  ON public.registrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
