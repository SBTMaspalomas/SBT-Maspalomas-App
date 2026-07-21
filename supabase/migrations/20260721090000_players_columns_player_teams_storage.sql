-- =============================================================================
-- FASE 0 · Saneamiento — versiona los cambios "hechos a mano" sobre players,
-- la tabla intermedia player_teams y el bucket de Storage 'player-docs'.
--
-- Estos objetos existían en la BD viva (creados manualmente / por Lovable) pero
-- no estaban versionados. Se promueven aquí desde `supabase/manual/` para que
-- formen parte del pipeline de migraciones. Todo es ADITIVO e IDEMPOTENTE.
--
-- Nota: el enum app_role y el helper public.has_role() se crearon fuera de
-- migraciones (igual que en el resto del repo); estas migraciones asumen su
-- existencia, como ya hacen las migraciones previas.
-- =============================================================================

-- 1. players: columnas nuevas.
--    avatar_url  → personalización de avatar (se lee en el código).
--    user_id     → vincula un jugador con un usuario adulto (caso SENIOR:
--                  adulto que además es jugador de sí mismo).
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);

-- 2. players: políticas RLS adicionales.
--    - SELECT/INSERT del propio jugador cuando players.user_id = auth.uid()
--      (SENIOR gestiona su propia ficha).
--    - UPDATE de la familia responsable sobre los hijos (avatar, etc.).
DROP POLICY IF EXISTS "players_select_self_user" ON public.players;
CREATE POLICY "players_select_self_user"
  ON public.players FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "players_insert_self_user" ON public.players;
CREATE POLICY "players_insert_self_user"
  ON public.players FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "players_update_own_family_or_self" ON public.players;
CREATE POLICY "players_update_own_family_or_self"
  ON public.players FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;

-- 3. player_teams: tabla intermedia para asignar un jugador a VARIOS equipos.
--    players.team_id se conserva como "equipo principal" por compatibilidad.
CREATE TABLE IF NOT EXISTS public.player_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, team_id)
);
CREATE INDEX IF NOT EXISTS player_teams_player_idx ON public.player_teams(player_id);
CREATE INDEX IF NOT EXISTS player_teams_team_idx ON public.player_teams(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_teams TO authenticated;
GRANT ALL ON public.player_teams TO service_role;
ALTER TABLE public.player_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_teams_admin_all" ON public.player_teams;
CREATE POLICY "player_teams_admin_all"
  ON public.player_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "player_teams_select_visible" ON public.player_teams;
CREATE POLICY "player_teams_select_visible"
  ON public.player_teams FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_teams.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );

-- 4. Storage: bucket 'player-docs'. El código sube avatares, documentos de
--    registro y comprobantes de pago a rutas cuyo PRIMER segmento es el
--    auth.uid() (p.ej. `${user.id}/...`). Estas políticas permiten a cada
--    usuario autenticado gestionar SOLO su propia carpeta.
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-docs', 'player-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "player_docs_insert_own_folder" ON storage.objects;
CREATE POLICY "player_docs_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "player_docs_update_own_folder" ON storage.objects;
CREATE POLICY "player_docs_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'player-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "player_docs_select_authenticated" ON storage.objects;
CREATE POLICY "player_docs_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-docs');
