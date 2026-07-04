
-- 1. Drop legacy tables (players, tutor_players) — data demo antiguo
DROP TABLE IF EXISTS public.tutor_players CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;

-- 2. Purga rows con roles obsoletos y restringe a admin/coach/family via CHECK
DELETE FROM public.user_roles WHERE role::text IN ('parent','player');

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_allowed;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_allowed
  CHECK (role::text IN ('admin','coach','family'));

-- 3. families_meta
CREATE TABLE public.families_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  head_email text UNIQUE,
  reference_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families_meta TO authenticated;
GRANT ALL ON public.families_meta TO service_role;
ALTER TABLE public.families_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all families_meta"
  ON public.families_meta FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Family reads own families_meta"
  ON public.families_meta FOR SELECT TO authenticated
  USING (head_profile_id = auth.uid());

CREATE TRIGGER families_meta_set_updated_at
  BEFORE UPDATE ON public.families_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. players (nuevo esquema)
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES public.families_meta(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  team_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all players"
  ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Family reads own children"
  ON public.players FOR SELECT TO authenticated
  USING (family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid()));

CREATE POLICY "Coaches read all players"
  ON public.players FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'coach'));

CREATE TRIGGER players_set_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Autogenerar reference_code a partir del hijo mayor
CREATE OR REPLACE FUNCTION public.compute_family_reference_code(_family_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(full_name,' ',1) || '.' ||
    COALESCE(NULLIF(substr(split_part(full_name,' ',2),1,1),''),'X') || '-' ||
    to_char(birth_date,'YY')
  FROM public.players
  WHERE family_id = _family_id AND birth_date IS NOT NULL
  ORDER BY birth_date ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.refresh_family_reference_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE fid uuid;
BEGIN
  fid := COALESCE(NEW.family_id, OLD.family_id);
  IF fid IS NOT NULL THEN
    UPDATE public.families_meta
      SET reference_code = public.compute_family_reference_code(fid),
          updated_at = now()
      WHERE id = fid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER players_refresh_reference_code
  AFTER INSERT OR UPDATE OR DELETE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.refresh_family_reference_code();

-- 6. Actualizar handle_new_user: rol family por defecto + auto-link por email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));

  IF new.email IN ('admin@club.com','admin@club.es') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'family';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, assigned_role);

  UPDATE public.families_meta
    SET head_profile_id = new.id, updated_at = now()
    WHERE head_email = new.email AND head_profile_id IS NULL;

  RETURN new;
END;
$$;

-- 7. Seed: 2 familias + 4 jugadores (reference_code se computa por trigger)
INSERT INTO public.families_meta (id, head_email) VALUES
  ('f0000000-0000-0000-0000-000000000001','familia@club.com'),
  ('f0000000-0000-0000-0000-000000000002','familia2@club.com');

INSERT INTO public.players (family_id, full_name, birth_date, team_id) VALUES
  ('f0000000-0000-0000-0000-000000000001','Luis Pérez',   '2009-05-14','Cadete B'),
  ('f0000000-0000-0000-0000-000000000001','Ana Pérez',    '2013-09-02','Alevín A'),
  ('f0000000-0000-0000-0000-000000000002','Diego Castro', '2011-03-20','Infantil A'),
  ('f0000000-0000-0000-0000-000000000002','Lucía Castro', '2014-11-08','Alevín B');
