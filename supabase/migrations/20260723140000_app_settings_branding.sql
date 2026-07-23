-- =============================================================================
-- Branding configurable por el administrador — logo del club.
--
-- Hasta ahora el logo estaba hardcodeado como una URL fija en el frontend
-- (pantalla de login y cabecera de la app). Con esta migración el administrador
-- puede sustituirlo cuando quiera subiendo un fichero PNG, JPG o GIF.
--
-- Se introduce:
--   1. Tabla clave/valor `public.app_settings` para ajustes globales de la app
--      (el primer ajuste es `logo_url`). Legible por cualquiera —incluida la
--      pantalla de login anónima—; solo el administrador puede escribir.
--   2. Bucket público de Storage `branding` donde el administrador sube el logo.
--
-- Todo es ADITIVO e IDEMPOTENTE.
-- =============================================================================

-- 1. Ajustes globales de la aplicación (clave/valor).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer los ajustes públicos (el logo se muestra en el login,
-- antes de iniciar sesión, por lo que también debe ser legible por `anon`).
DROP POLICY IF EXISTS app_settings_select_all ON public.app_settings;
CREATE POLICY app_settings_select_all ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Solo el administrador puede crear/editar/eliminar ajustes.
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Valor inicial: el logo histórico del club (el que estaba hardcodeado). Así la
-- app sigue mostrando el mismo logo hasta que el administrador suba otro.
INSERT INTO public.app_settings (key, value)
VALUES ('logo_url', 'https://kiifznmcpyvalupdtnrq.supabase.co/storage/v1/object/public/avatars/SBT%20logo-.png')
ON CONFLICT (key) DO NOTHING;

-- 2. Storage: bucket público `branding` para el logo del club.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública del bucket (el logo debe verse en el login sin sesión).
DROP POLICY IF EXISTS "branding_select_public" ON storage.objects;
CREATE POLICY "branding_select_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding');

-- Solo el administrador puede subir / reemplazar / borrar el logo.
DROP POLICY IF EXISTS "branding_admin_insert" ON storage.objects;
CREATE POLICY "branding_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
CREATE POLICY "branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;
CREATE POLICY "branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
