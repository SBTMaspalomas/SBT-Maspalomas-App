-- =============================================================================
-- FASE 1 · Calendario e Importación GesDeportiva (Módulo 6).
--
-- Crea la persistencia real de partidos. Hasta ahora los partidos vivían en el
-- store en memoria (`clubStore.matches`) y nunca se hidrataban, por lo que las
-- vistas de jornada/calendario aparecían siempre vacías. Esta tabla es el núcleo
-- deportivo del que dependen Jornada, Calendario, Convocatorias y Cartelera.
--
-- Los partidos se crean manualmente (admin/coach vía MatchesManager). El
-- importador del Excel semanal (UPSERT por `match_number`) se pospone: por eso
-- `match_number` se modela con un índice único parcial preparado para ese UPSERT,
-- sin bloquear los partidos manuales que no llevan número oficial.
-- Depende de teams (ya versionada). ADITIVO e IDEMPOTENTE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  -- Rival (equipo contrario). El nombre del equipo del club se resuelve por team_id.
  opponent text NOT NULL,
  -- true = juega en casa (CASA), false = fuera (FUERA). Determina el orden
  -- federativo Local-Visitante y la aparición del enlace al pabellón en Maps.
  is_home boolean NOT NULL DEFAULT true,
  match_date date NOT NULL,
  match_time text,
  -- Pabellón/campo de juego y su dirección (para abrir la ruta en Google Maps).
  venue text,
  venue_address text,
  -- Fase de liga (calendarios escalonados / múltiples fases). Opcional.
  phase text,
  -- Nº oficial federativo. Clave del futuro UPSERT del importador de Excel.
  match_number text,
  -- 'scheduled' | 'played' | 'cancelled'
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_team_date_idx ON public.matches(team_id, match_date);
-- Único por número oficial SOLO cuando existe: permite el UPSERT del importador
-- y a la vez varios partidos manuales sin número.
CREATE UNIQUE INDEX IF NOT EXISTS matches_match_number_key
  ON public.matches(match_number) WHERE match_number IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Mantener updated_at (helper ya existente en el repo).
DROP TRIGGER IF EXISTS matches_set_updated_at ON public.matches;
CREATE TRIGGER matches_set_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin y coach gestionan el calendario (mismo patrón "grueso" que convocatorias:
-- el scoping por equipo del coach se hace en la UI). WITH CHECK obliga a firmar la
-- fila con el propio uid.
DROP POLICY IF EXISTS "matches_staff_manage" ON public.matches;
CREATE POLICY "matches_staff_manage"
  ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    AND created_by = auth.uid()
  );

-- Los partidos son públicos dentro del club: cualquier autenticado los lee
-- (jugadores, familias, senior, staff…).
DROP POLICY IF EXISTS "matches_select_all_auth" ON public.matches;
CREATE POLICY "matches_select_all_auth"
  ON public.matches FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Seed de partidos fake para comprobar el funcionamiento (idempotente).
-- Referencia los equipos ya sembrados: Mini A (1111…) y Cadete B (2222…).
-- Fechas relativas para que siempre haya "próxima jornada".
-- -----------------------------------------------------------------------------
INSERT INTO public.matches
  (id, team_id, opponent, is_home, match_date, match_time, venue, venue_address, phase, match_number, status)
VALUES
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'CB Gran Canaria', true, (now() + interval '3 days')::date, '10:00',
   'Pabellón Municipal de Maspalomas', 'Av. de Tirajana, 35100 Maspalomas, Las Palmas',
   'Liga Regular · 1ª Vuelta', 'MINI-2601', 'scheduled'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'CB Telde', false, (now() + interval '10 days')::date, '12:30',
   'Pabellón de Telde', 'C. Domingo Rivero, 35200 Telde, Las Palmas',
   'Liga Regular · 1ª Vuelta', 'MINI-2602', 'scheduled'),
  ('d0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Estudiantes Las Palmas', true, (now() + interval '4 days')::date, '18:00',
   'Pabellón Municipal de Maspalomas', 'Av. de Tirajana, 35100 Maspalomas, Las Palmas',
   'Liga Cadete · Fase 1', 'CAD-2610', 'scheduled'),
  ('d0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'CB Arucas', false, (now() + interval '11 days')::date, '17:00',
   'Pabellón de Arucas', 'C. Juan de Bethencourt, 35400 Arucas, Las Palmas',
   'Liga Cadete · Fase 1', 'CAD-2611', 'scheduled'),
  ('d0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   'CB Vecindario', true, (now() + interval '18 days')::date, '19:30',
   'Pabellón Municipal de Maspalomas', 'Av. de Tirajana, 35100 Maspalomas, Las Palmas',
   'Liga Cadete · Fase 1', 'CAD-2612', 'scheduled')
ON CONFLICT (id) DO NOTHING;
