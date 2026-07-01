
-- Add 'player' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'player';

-- TEAMS
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_admin_all ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY teams_select_all_auth ON public.teams FOR SELECT TO authenticated USING (true);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLAYERS
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY players_admin_all ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY players_select_self ON public.players FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY players_select_coach ON public.players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_teams ct WHERE ct.user_id = auth.uid() AND ct.team_id::text = players.team_id::text));
CREATE TRIGGER players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TUTOR_PLAYERS (many-to-many parent/tutor ↔ player)
CREATE TABLE public.tutor_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'tutor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_user_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_players TO authenticated;
GRANT ALL ON public.tutor_players TO service_role;
ALTER TABLE public.tutor_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY tutor_players_admin_all ON public.tutor_players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY tutor_players_select_own ON public.tutor_players FOR SELECT TO authenticated
  USING (tutor_user_id = auth.uid());

-- Extend players SELECT so a tutor can see their linked players
CREATE POLICY players_select_tutor ON public.players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tutor_players tp WHERE tp.player_id = players.id AND tp.tutor_user_id = auth.uid()));

-- STANDINGS
CREATE TABLE public.standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  opponent_name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standings TO authenticated;
GRANT ALL ON public.standings TO service_role;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY standings_admin_all ON public.standings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY standings_select_all_auth ON public.standings FOR SELECT TO authenticated USING (true);
CREATE TRIGGER standings_updated_at BEFORE UPDATE ON public.standings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLUB EVENTS (championships, tournaments, special dates)
CREATE TABLE public.club_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'evento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_events TO authenticated;
GRANT ALL ON public.club_events TO service_role;
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_events_admin_all ON public.club_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY club_events_select_all_auth ON public.club_events FOR SELECT TO authenticated USING (true);
CREATE TRIGGER club_events_updated_at BEFORE UPDATE ON public.club_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sample data
INSERT INTO public.teams (id, name, category) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mini A', 'Mini (10-11 años)'),
  ('22222222-2222-2222-2222-222222222222', 'Cadete B', 'Cadete (14-15 años)');

INSERT INTO public.standings (team_id, opponent_name, position, wins, losses, points) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mini A', 1, 6, 1, 13),
  ('11111111-1111-1111-1111-111111111111', 'CB Rivas', 2, 5, 2, 12),
  ('11111111-1111-1111-1111-111111111111', 'Estudiantes B', 3, 3, 4, 10),
  ('22222222-2222-2222-2222-222222222222', 'Cadete B', 2, 4, 3, 11),
  ('22222222-2222-2222-2222-222222222222', 'Pozuelo CB', 1, 6, 1, 13),
  ('22222222-2222-2222-2222-222222222222', 'Alcobendas', 3, 3, 4, 10);

INSERT INTO public.club_events (title, description, event_date, kind) VALUES
  ('Torneo de Reyes', 'Torneo interno del club, todas las categorías.', (now() + interval '20 days')::date, 'torneo'),
  ('Campus de Semana Santa', 'Campus intensivo del 25 al 29 de marzo.', (now() + interval '60 days')::date, 'campus'),
  ('Fiesta fin de temporada', 'Entrega de trofeos y comida familiar.', (now() + interval '150 days')::date, 'evento');
