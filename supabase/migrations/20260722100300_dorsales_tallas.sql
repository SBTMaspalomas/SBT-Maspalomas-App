-- =============================================================================
-- FASE 5 (subconjunto) · Dorsales blindados + tallas condicionales (Módulo 9).
--
-- - Dorsal por jugador y equipo, único dentro del mismo equipo (blindado). Lo
--   fija el entrenador vía RPC (sin ampliar su permiso de escritura sobre
--   player_teams, que sigue siendo admin-only para asignar equipos).
-- - Nivel del equipo (`travels`): un equipo que viaja usa el pack completo de
--   ropa; uno de liga local sólo la equipación reversible.
-- - Tallas por jugador (equipment_sizes), gestionadas por la familia/senior.
-- Depende de player_teams, teams y players (ya versionadas). ADITIVO/IDEMPOTENTE.
-- =============================================================================

-- 1. Dorsal en la tabla intermedia player_teams (dorsal por equipo).
ALTER TABLE public.player_teams ADD COLUMN IF NOT EXISTS dorsal integer;

-- Blindaje: no puede haber dos dorsales iguales dentro del mismo equipo.
-- Índice parcial: los NULL (sin dorsal asignado) no colisionan entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS player_teams_team_dorsal_unique
  ON public.player_teams(team_id, dorsal) WHERE dorsal IS NOT NULL;

-- 2. Nivel del equipo para el pack de tallas.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS travels boolean NOT NULL DEFAULT false;

-- 3. RPC para que admin/coach fijen el dorsal. SECURITY DEFINER (patrón de
--    set_self_registration_role): hace upsert del vínculo player_teams y traduce
--    la colisión del índice único en un error claro. Pasar _dorsal = NULL borra
--    el dorsal (los NULL no colisionan en el índice parcial).
CREATE OR REPLACE FUNCTION public.set_player_dorsal(
  _player_id uuid,
  _team_id uuid,
  _dorsal integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach')) THEN
    RAISE EXCEPTION 'No autorizado para asignar dorsales';
  END IF;

  INSERT INTO public.player_teams (player_id, team_id, dorsal)
    VALUES (_player_id, _team_id, _dorsal)
    ON CONFLICT (player_id, team_id) DO UPDATE SET dorsal = EXCLUDED.dorsal;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'El dorsal % ya está asignado en este equipo', _dorsal;
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_dorsal(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_dorsal(uuid, uuid, integer) TO authenticated;

-- 4. Tallas por jugador (una fila por jugador). La familia/senior las gestiona;
--    admin/coach las leen (para agrupar pedidos en el futuro Módulo 9 completo).
CREATE TABLE IF NOT EXISTS public.equipment_sizes (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  reversible_size text,
  tracksuit_size text,
  polo_size text,
  hoodie_size text,
  backpack_size text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_sizes TO authenticated;
GRANT ALL ON public.equipment_sizes TO service_role;
ALTER TABLE public.equipment_sizes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS equipment_sizes_set_updated_at ON public.equipment_sizes;
CREATE TRIGGER equipment_sizes_set_updated_at
  BEFORE UPDATE ON public.equipment_sizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin gestiona todo.
DROP POLICY IF EXISTS "equipment_sizes_admin_all" ON public.equipment_sizes;
CREATE POLICY "equipment_sizes_admin_all"
  ON public.equipment_sizes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Coach lee las tallas (para logística de ropa).
DROP POLICY IF EXISTS "equipment_sizes_coach_read" ON public.equipment_sizes;
CREATE POLICY "equipment_sizes_coach_read"
  ON public.equipment_sizes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

-- Familia/senior gestionan las tallas del jugador que les corresponde.
DROP POLICY IF EXISTS "equipment_sizes_manage_own" ON public.equipment_sizes;
CREATE POLICY "equipment_sizes_manage_own"
  ON public.equipment_sizes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = equipment_sizes.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = equipment_sizes.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );
