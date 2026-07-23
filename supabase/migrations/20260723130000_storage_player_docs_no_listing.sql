-- =============================================================================
-- Convierte el bucket `player-docs` en PRIVADO y restringe la lectura por ámbito.
--
-- Resuelve el warning del linter 0025_public_bucket_allows_listing y, sobre todo,
-- cierra el problema de fondo: el bucket era PÚBLICO y guarda documentación
-- sensible por jugador (ficha federativa, foto de carnet, DNI/NIE/pasaporte
-- escaneado, comprobantes de pago, documentos de registro). Siendo público,
-- cualquiera con la URL —incluso sin sesión— podía descargar el fichero, y las
-- políticas SELECT amplias permitían además LISTAR todo el bucket.
--
-- A partir de aquí:
--   * El bucket es privado: no hay acceso por URL pública. La app genera URLs
--     firmadas de corta duración en el momento de la lectura (ver src/lib/storage.ts).
--   * Solo cambia la LECTURA. Las políticas INSERT/UPDATE existentes no se tocan,
--     así que las subidas siguen funcionando igual.
--   * Se sustituyen las SELECT amplias por SELECT acotadas: cada quien firma solo
--     lo que le corresponde. El admin ya tiene acceso total vía `player_docs_admin_all`.
--
-- Rutas de objeto en uso y quién debe poder leerlas:
--   * `${auth.uid()}/...`      -> el propio usuario (avatares, docs de registro,
--                                 ficha federativa firmada, etc.). -> carpeta propia.
--   * `players/${playerId}/...`-> docs que sube el admin por jugador; los descarga
--                                 la familia/senior de ESE jugador. -> jugador propio.
--   * `payments/${paymentId}/..`-> comprobante de pago; lo ve la familia/jugador
--                                 dueño de la cuota. -> recibo propio.
--
-- ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- 1. Eliminar las políticas SELECT amplias que permitían listar todo el bucket.
--    `player_docs_select_authenticated` está versionada; `Public read player-docs`
--    se creó a mano en el dashboard.
DROP POLICY IF EXISTS "player_docs_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Public read player-docs" ON storage.objects;

-- 2. Marcar el bucket como privado (deshabilita el acceso por URL pública).
UPDATE storage.buckets SET public = false WHERE id = 'player-docs';

-- 3. SELECT · carpeta propia del usuario (primer segmento = su auth.uid()).
DROP POLICY IF EXISTS "player_docs_select_own_folder" ON storage.objects;
CREATE POLICY "player_docs_select_own_folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. SELECT · documentación que el admin sube por jugador (`players/${playerId}/…`),
--    legible por la familia responsable o por el propio jugador senior.
DROP POLICY IF EXISTS "player_docs_select_own_players" ON storage.objects;
CREATE POLICY "player_docs_select_own_players"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = 'players'
    AND EXISTS (
      SELECT 1
      FROM public.players p
      LEFT JOIN public.families_meta f ON f.id = p.family_id
      WHERE p.id::text = (storage.foldername(name))[2]
        AND (p.user_id = auth.uid() OR f.head_profile_id = auth.uid())
    )
  );

-- 5. SELECT · comprobantes de pago (`payments/${paymentId}/…`), legibles por la
--    familia o el jugador senior dueño de la cuota (mismo criterio que
--    `payments_select_own`).
DROP POLICY IF EXISTS "player_docs_select_own_payments" ON storage.objects;
CREATE POLICY "player_docs_select_own_payments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = 'payments'
    AND EXISTS (
      SELECT 1
      FROM public.payments pay
      WHERE pay.id::text = (storage.foldername(name))[2]
        AND (
          pay.family_id IN (
            SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid()
          )
          OR pay.player_id IN (
            SELECT id FROM public.players WHERE user_id = auth.uid()
          )
        )
    )
  );
