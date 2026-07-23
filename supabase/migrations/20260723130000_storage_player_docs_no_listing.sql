-- =============================================================================
-- Cierra el listado de ficheros del bucket público `player-docs`.
--
-- El linter de seguridad de Supabase reporta:
--   * 0025_public_bucket_allows_listing -> el bucket público tiene políticas
--     SELECT amplias sobre `storage.objects` que permiten a los clientes LISTAR
--     todos los ficheros del bucket.
--
-- El bucket `player-docs` es público y guarda documentación sensible por jugador
-- (ficha federativa, foto, DNI/NIE/pasaporte escaneado, comprobantes de pago).
-- La app NUNCA lista el bucket: solo sube (`.upload()`, cubierto por las
-- políticas INSERT/UPDATE `player_docs_*_own_folder` y `player_docs_admin_all`)
-- y descarga por URL pública (`getPublicUrl()`, que en un bucket público NO
-- requiere política SELECT). Por tanto estas políticas SELECT amplias no aportan
-- funcionalidad y solo exponen la posibilidad de enumerar todos los objetos.
--
-- Se eliminan ambas políticas SELECT:
--   * `player_docs_select_authenticated` (versionada en 20260721090000).
--   * `Public read player-docs` (creada a mano desde el dashboard/Lovable).
--
-- ADITIVO e IDEMPOTENTE: DROP POLICY IF EXISTS es un no-op si ya no existen.
-- =============================================================================

DROP POLICY IF EXISTS "player_docs_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Public read player-docs" ON storage.objects;
