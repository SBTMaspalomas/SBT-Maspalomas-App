-- =============================================================================
-- FASE 6 · Cartelera / Tablón definitivo.
--
-- Consolida el tablón general del club (hasta ahora un placeholder
-- "PRÓXIMAMENTE" en NewsBoard.tsx y una versión demo sobre clubStore en
-- Board.tsx) en una tabla real de Supabase. Admin y coach publican anuncios
-- para todo el club; cualquier usuario autenticado los lee. Refresco en vivo
-- vía Realtime. Depende de profiles (ya versionada). ADITIVO e IDEMPOTENTE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  -- Anuncio fijado arriba en la cartelera (avisos importantes/"sagrados").
  pinned boolean NOT NULL DEFAULT false,
  -- Autor del anuncio (admin/coach). SET NULL si se elimina la cuenta.
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_pinned_created_idx
  ON public.announcements(pinned DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Mantener updated_at (helper ya existente en el repo).
DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin y coach gestionan (publican/editan/borran) la cartelera. WITH CHECK
-- obliga a que quien publica firme la fila con su propio uid.
DROP POLICY IF EXISTS "announcements_staff_manage" ON public.announcements;
CREATE POLICY "announcements_staff_manage"
  ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    AND author_id = auth.uid()
  );

-- Tablón general: cualquier usuario autenticado del club lee los anuncios.
DROP POLICY IF EXISTS "announcements_select_all_auth" ON public.announcements;
CREATE POLICY "announcements_select_all_auth"
  ON public.announcements FOR SELECT TO authenticated USING (true);

-- Realtime: la cartelera se refresca en vivo cuando se publica/edita/borra un
-- anuncio. Se añade a la publicación supabase_realtime de forma idempotente
-- (Postgres no soporta IF NOT EXISTS en ALTER PUBLICATION ... ADD TABLE).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
END $$;
