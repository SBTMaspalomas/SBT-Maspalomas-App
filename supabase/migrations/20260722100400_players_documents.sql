-- =============================================================================
-- FASE 4 · Documentación por jugador gestionada por el administrador.
--
-- Hasta ahora la Ficha Federativa que el jugador descargaba era una plantilla en
-- blanco genérica. A partir de esta fase el administrador sube, POR JUGADOR, su
-- ficha federativa cumplimentada en PDF, su foto y su documento de identidad al
-- bucket de Storage `player-docs`, y registra el tipo y número de documento.
--
-- La familia/senior descarga la ficha federativa de su(s) jugador(es) desde la
-- propia tabla `players` (FederativaDoc). Todo es ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- 1. players: documentos y datos de identidad gestionados por el admin.
--    federativa_pdf_url  → PDF de la ficha federativa cumplimentada (descarga).
--    photo_url           → foto (carnet) del jugador.
--    id_document_url     → documento de identidad escaneado (DNI/NIE/Pasaporte…).
--    id_document_type    → tipo de documento (DNI | NIE | Pasaporte | DNI tutor).
--    id_document_number  → número del documento.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS federativa_pdf_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_type text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_number text;

-- Restringe id_document_type a los valores admitidos (permite NULL mientras no se
-- haya informado). Se recrea de forma idempotente.
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_id_document_type_allowed;
ALTER TABLE public.players
  ADD CONSTRAINT players_id_document_type_allowed
  CHECK (id_document_type IS NULL OR id_document_type IN ('DNI', 'NIE', 'Pasaporte', 'DNI tutor'));

-- 2. Storage: el administrador debe poder subir/gestionar documentos de CUALQUIER
--    jugador (rutas `players/${playerId}/...`), no solo de su propia carpeta. Las
--    políticas previas (`player_docs_*_own_folder`) limitan a cada usuario a su
--    carpeta `${auth.uid()}/...`; esta política añade acceso total al admin sobre
--    el bucket. La lectura ya está abierta a autenticados y el bucket es público,
--    por lo que la familia/senior descarga la ficha por URL pública.
DROP POLICY IF EXISTS "player_docs_admin_all" ON storage.objects;
CREATE POLICY "player_docs_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'player-docs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'player-docs' AND public.has_role(auth.uid(), 'admin'));
