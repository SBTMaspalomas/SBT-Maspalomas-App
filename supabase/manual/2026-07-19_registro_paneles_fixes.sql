-- =============================================================================
-- SBT Maspalomas · SQL manual (APLICAR A MANO en Supabase/Lovable)
-- Fecha: 2026-07-19
-- Rama: claude/registro-paneles-fixes-uzbrvr
--
-- ⚠️  Este fichero NO forma parte del pipeline de migraciones
--     (`supabase/migrations/`). No se aplica automáticamente. Ejecútalo tú
--     mismo en el SQL Editor de Supabase (o en la consola de Lovable) para
--     que el código de esta rama funcione correctamente.
--
-- Es ADITIVO e IDEMPOTENTE: se puede ejecutar varias veces sin romper nada.
-- Recomendación: ejecútalo por bloques (los ALTER TYPE ... ADD VALUE deben ir
-- en su propia transacción; ejecuta el BLOQUE 1 y confirma antes de seguir).
-- =============================================================================


-- =============================================================================
-- BLOQUE 1 — Nuevos valores del enum app_role  (ejecutar y CONFIRMAR primero)
-- Postgres no permite usar un valor de enum recién añadido en la misma
-- transacción en la que se crea. Ejecuta este bloque solo y aparte.
-- =============================================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'senior';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';


-- =============================================================================
-- BLOQUE 2 — Resto de cambios (ejecutar DESPUÉS de confirmar el BLOQUE 1)
-- =============================================================================

-- 2.1 Ampliar el CHECK de user_roles para admitir los nuevos roles.
--     Hoy sólo permite ('admin','coach','family') — ver migración
--     20260704205337_...:11-13.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_allowed;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_allowed
  CHECK (role::text IN ('admin', 'coach', 'family', 'senior', 'staff'));


-- 2.2 players: columnas nuevas.
--     avatar_url  → personalización de avatar (ya se lee en el código).
--     user_id     → vincula un jugador con un usuario adulto (caso SENIOR:
--                   adulto que además es jugador de sí mismo).
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS players_user_id_idx ON public.players(user_id);


-- 2.3 players: políticas RLS adicionales.
--     - SELECT/INSERT/UPDATE del propio jugador cuando players.user_id = auth.uid()
--       (SENIOR gestiona su propia ficha).
--     - UPDATE de la familia responsable sobre los hijos (avatar, etc.);
--       hoy sólo el admin puede hacer UPDATE.
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


-- 2.4 player_teams: tabla intermedia para asignar un jugador a VARIOS equipos.
--     players.team_id se conserva como "equipo principal" por compatibilidad.
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


-- 2.5 Storage: bucket 'player-docs'. El código sube avatares y documentos a
--     rutas cuyo PRIMER segmento es el auth.uid() (p.ej. `${user.id}/...`).
--     Estas políticas permiten a cada usuario autenticado gestionar SOLO su
--     propia carpeta. (Si ya existen equivalentes, este bloque las recrea con
--     el mismo criterio.)
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


-- 2.6 convocatorias / convocatoria_responses.
--     El código ya las usa (ConvocatoriesManager / ConvocatoriesPlayer) pero no
--     estaban versionadas. CREATE ... IF NOT EXISTS es seguro si ya existen en
--     la BD viva (no se recrean). Las políticas se recrean de forma idempotente.
CREATE TABLE IF NOT EXISTS public.convocatorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'training',
  date date NOT NULL,
  time text,
  location text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.convocatoria_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  problem_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convocatoria_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatoria_responses TO authenticated;
GRANT ALL ON public.convocatorias TO service_role;
GRANT ALL ON public.convocatoria_responses TO service_role;

ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatoria_responses ENABLE ROW LEVEL SECURITY;

-- Convocatorias: admin y coach crean/gestionan; el resto de autenticados leen.
DROP POLICY IF EXISTS "convocatorias_manage" ON public.convocatorias;
CREATE POLICY "convocatorias_manage"
  ON public.convocatorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  );

DROP POLICY IF EXISTS "convocatorias_select_all_auth" ON public.convocatorias;
CREATE POLICY "convocatorias_select_all_auth"
  ON public.convocatorias FOR SELECT TO authenticated
  USING (true);

-- Respuestas: admin/coach gestionan todo; jugador/familia gestionan la respuesta
-- del jugador que les corresponde.
DROP POLICY IF EXISTS "convocatoria_responses_staff_all" ON public.convocatoria_responses;
CREATE POLICY "convocatoria_responses_staff_all"
  ON public.convocatoria_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'));

DROP POLICY IF EXISTS "convocatoria_responses_select_own" ON public.convocatoria_responses;
CREATE POLICY "convocatoria_responses_select_own"
  ON public.convocatoria_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = convocatoria_responses.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "convocatoria_responses_upsert_own" ON public.convocatoria_responses;
CREATE POLICY "convocatoria_responses_upsert_own"
  ON public.convocatoria_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = convocatoria_responses.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "convocatoria_responses_update_own" ON public.convocatoria_responses;
CREATE POLICY "convocatoria_responses_update_own"
  ON public.convocatoria_responses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = convocatoria_responses.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = convocatoria_responses.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );

-- 2.7 RPC para que un usuario fije su rol PRINCIPAL durante el registro.
--     Un usuario autenticado no puede escribir en user_roles (RLS), así que
--     el frontend llama a esta función SECURITY DEFINER. Sólo admite el
--     conjunto no privilegiado de roles de auto-registro (nunca 'admin').
CREATE OR REPLACE FUNCTION public.set_self_registration_role(_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _role NOT IN ('family', 'senior', 'staff', 'coach') THEN
    RAISE EXCEPTION 'Rol de registro no permitido: %', _role;
  END IF;
  -- Sustituye el rol por defecto (family) por el elegido en el registro.
  DELETE FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('family', 'senior', 'staff', 'coach', 'parent', 'player');
  INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), _role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.set_self_registration_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_self_registration_role(text) TO authenticated;

-- =============================================================================
-- FIN
-- =============================================================================
