-- =============================================================================
-- FASE 0 · Saneamiento — versiona `convocatorias`, `convocatoria_responses` y el
-- RPC public.set_self_registration_role usado en el registro.
--
-- Las convocatorias las gestionan el admin/entrenador (ConvocatoriesManager) y
-- las responden jugador/familia (ConvocatoriesPlayer). Existían en la BD viva
-- pero no estaban versionadas. Depende de players.user_id (migración
-- 20260721090000). ADITIVO e IDEMPOTENTE.
-- =============================================================================

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

-- RPC para que un usuario fije su rol PRINCIPAL durante el registro.
-- Un usuario autenticado no puede escribir en user_roles (RLS), así que el
-- frontend llama a esta función SECURITY DEFINER. Sólo admite el conjunto no
-- privilegiado de roles de auto-registro (nunca 'admin').
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
