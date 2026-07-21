-- =============================================================================
-- FASE 0 · Saneamiento — versiona la tabla `registrations`.
--
-- La usa el flujo de admisión (RegistrationFlow inserta la ficha del adulto y de
-- los menores) y la consola de validación del admin (ValidationConsole lee y
-- aprueba/rechaza documento a documento). Existía en la BD viva pero no estaba
-- versionada. ADITIVO e IDEMPOTENTE: CREATE ... IF NOT EXISTS no recrea la tabla
-- si ya existe; las columnas y políticas se aseguran de forma idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL DEFAULT 'adult',
  full_name text,
  doc_type text,
  doc_number text,
  birth_date date,
  phone text,
  email text,
  -- URLs de los documentos subidos a Storage (bucket player-docs).
  photo_url text,
  dni_front_url text,
  dni_back_url text,
  signature_url text,
  -- Autorizaciones marcadas en el formulario de registro.
  auth_image boolean,
  auth_travel boolean,
  auth_medical boolean,
  auth_data_sharing boolean,
  -- Estado global del registro y, por documento, el semáforo del validador.
  doc_status text DEFAULT 'pending',
  photo_status text,
  dni_front_status text,
  dni_back_status text,
  signature_status text,
  reject_reason text,
  family_id uuid,
  parent_registration_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Columnas del semáforo por documento (aseguradas por si la tabla ya existía en
-- la BD viva sin ellas). El código las trata como nullable (null = pendiente).
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS photo_status text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS dni_front_status text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS dni_back_status text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS signature_status text;

CREATE INDEX IF NOT EXISTS registrations_user_id_idx ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS registrations_family_id_idx ON public.registrations(family_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- El administrador gestiona todos los registros (validación de documentos).
DROP POLICY IF EXISTS "registrations_admin_all" ON public.registrations;
CREATE POLICY "registrations_admin_all"
  ON public.registrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cada usuario ve e inserta sus propios registros (los suyos y los de sus
-- menores, que se guardan con user_id = auth.uid() del adulto responsable).
DROP POLICY IF EXISTS "registrations_select_own" ON public.registrations;
CREATE POLICY "registrations_select_own"
  ON public.registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "registrations_insert_own" ON public.registrations;
CREATE POLICY "registrations_insert_own"
  ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
