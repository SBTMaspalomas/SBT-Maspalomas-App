-- =============================================================================
-- FASE 3 · Asistencia en Supabase (Módulo 5).
--
-- Persiste el control de asistencia que hasta ahora vivía en localStorage
-- (`attendance_v2`, ver src/components/club/Attendance.tsx). El entrenador marca
-- Presente/Retraso/Falta por jugador y fecha; el histórico mensual se calcula
-- leyendo las filas del mes. Depende de players y teams (ya versionadas).
-- ADITIVO e IDEMPOTENTE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  -- 'present' | 'late' | 'absent'
  status text NOT NULL,
  -- 'justified' | 'unjustified' | null (solo aplica cuando status = 'absent')
  absent_reason text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Una única marca por jugador, equipo y día (permite upsert).
  UNIQUE (player_id, team_id, date)
);

CREATE INDEX IF NOT EXISTS attendance_team_date_idx ON public.attendance(team_id, date);
CREATE INDEX IF NOT EXISTS attendance_player_idx ON public.attendance(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Mantener updated_at (helper ya existente en el repo).
DROP TRIGGER IF EXISTS attendance_set_updated_at ON public.attendance;
CREATE TRIGGER attendance_set_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin y coach gestionan la asistencia (mismo patrón "grueso" que
-- convocatorias: el scoping por equipo se hace en la UI). WITH CHECK obliga a
-- que quien escribe firme la fila con su propio uid.
DROP POLICY IF EXISTS "attendance_staff_manage" ON public.attendance;
CREATE POLICY "attendance_staff_manage"
  ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    AND recorded_by = auth.uid()
  );

-- Jugador/familia leen la asistencia del jugador que les corresponde.
DROP POLICY IF EXISTS "attendance_select_own" ON public.attendance;
CREATE POLICY "attendance_select_own"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = attendance.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );
