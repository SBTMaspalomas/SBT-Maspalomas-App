-- =============================================================================
-- Login por nombre de usuario + provisión de cuentas de familias por el admin.
--
-- 1. profiles.username: nombre de usuario para las cuentas provisionadas por el
--    club (los padres/tutores entran con "usuario" en vez de email; el email es
--    sintético `usuario@sbtmaspalomas.local` y no se muestra).
-- 2. handle_new_user: persiste `username` desde la metadata al crear el perfil.
-- 3. provisioned_credentials: tabla admin-only que guarda usuario + contraseña
--    temporal generados, para poder distribuirlos/exportarlos sin copiarlos uno
--    a uno. La contraseña temporal se borra en cuanto el padre la cambia.
-- 4. clear_my_provisioned_password: RPC que ejecuta el propio padre en su primer
--    acceso para invalidar su contraseña temporal (single-use).
--
-- ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- 1. Columna username + unicidad case-insensitive (parcial: ignora NULLs).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. handle_new_user: igual que antes pero copiando username desde la metadata.
--    Los emails sintéticos no están en la allow-list admin → obtienen 'family'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'username'
  );

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

-- 3. Tabla de credenciales provisionadas (solo administradores).
CREATE TABLE IF NOT EXISTS public.provisioned_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  family_id uuid,
  username text NOT NULL,
  temp_password text,             -- se pone a NULL tras el primer cambio de contraseña
  child_name text,
  used boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provisioned_credentials_user_idx
  ON public.provisioned_credentials(user_id);
CREATE INDEX IF NOT EXISTS provisioned_credentials_player_idx
  ON public.provisioned_credentials(player_id);

GRANT ALL ON public.provisioned_credentials TO service_role;
GRANT SELECT ON public.provisioned_credentials TO authenticated;
ALTER TABLE public.provisioned_credentials ENABLE ROW LEVEL SECURITY;

-- Solo el admin ve/gestiona las credenciales (contienen contraseñas temporales).
DROP POLICY IF EXISTS "prov_creds_admin_all" ON public.provisioned_credentials;
CREATE POLICY "prov_creds_admin_all"
  ON public.provisioned_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. RPC: el padre invalida su propia contraseña temporal en el primer acceso.
--    SECURITY DEFINER porque el usuario no tiene RLS de escritura sobre la tabla.
CREATE OR REPLACE FUNCTION public.clear_my_provisioned_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.provisioned_credentials
    SET temp_password = NULL, used = true
    WHERE user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_my_provisioned_password() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_my_provisioned_password() TO authenticated;
