-- =============================================================================
-- FASE 2 · Convocatorias completas (Módulo 10) — sin vincular a partido.
--
-- Añade el mínimo federativo exigido en acta y la tabla de jugadores "doblados"
-- (citados de otras categorías autorizados a jugar con el equipo). El vínculo a
-- un `match` concreto se pospone a la Fase 1 (tabla matches inexistente hoy).
-- Depende de convocatorias y players (ya versionadas). ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- Mínimo de jugadores exigido en acta (null = sin mínimo definido). La UI marca
-- en rojo el contador cuando los confirmados no llegan a este número.
ALTER TABLE public.convocatorias ADD COLUMN IF NOT EXISTS min_players integer;

-- Jugadores "doblados": citados a una convocatoria aunque no sean del team_id
-- de la misma (p. ej. suben de una categoría inferior autorizada).
CREATE TABLE IF NOT EXISTS public.convocatoria_extra_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convocatoria_id, player_id)
);

CREATE INDEX IF NOT EXISTS convocatoria_extra_players_conv_idx
  ON public.convocatoria_extra_players(convocatoria_id);
CREATE INDEX IF NOT EXISTS convocatoria_extra_players_player_idx
  ON public.convocatoria_extra_players(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatoria_extra_players TO authenticated;
GRANT ALL ON public.convocatoria_extra_players TO service_role;
ALTER TABLE public.convocatoria_extra_players ENABLE ROW LEVEL SECURITY;

-- Admin/coach gestionan a quién doblan (mismo patrón que convocatorias_manage).
DROP POLICY IF EXISTS "extra_players_staff_manage" ON public.convocatoria_extra_players;
CREATE POLICY "extra_players_staff_manage"
  ON public.convocatoria_extra_players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    AND created_by = auth.uid()
  );

-- El jugador/familia ve si le han doblado (para que su convocatoria aparezca).
DROP POLICY IF EXISTS "extra_players_select_own" ON public.convocatoria_extra_players;
CREATE POLICY "extra_players_select_own"
  ON public.convocatoria_extra_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = convocatoria_extra_players.player_id
        AND (
          p.user_id = auth.uid()
          OR p.family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
        )
    )
  );

-- Realtime: el panel del entrenador refresca en vivo respuestas y doblados. Se
-- añaden ambas tablas a la publicación supabase_realtime de forma idempotente
-- (Postgres no soporta IF NOT EXISTS en ALTER PUBLICATION ... ADD TABLE).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'convocatoria_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.convocatoria_responses;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'convocatoria_extra_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.convocatoria_extra_players;
  END IF;
END $$;
