-- =============================================================================
-- Chats de rol (ADMINISTRADORES / ENTRENADORES / STAFF) + gestión de canales
-- por parte del administrador (toggle activar, abrir/cerrar/archivar, eliminar).
--
-- Reutiliza la infraestructura existente:
--   · public.team_messages     → mensajes de grupo (team/family/broadcast + roles)
--   · public.user_can_access_team_channel(...) → control de acceso por canal
-- y añade una tabla de configuración de canales (public.chat_channels).
-- Todo es aditivo e idempotente.
-- =============================================================================

-- 1. Permitir los roles 'senior' y 'staff' en user_roles (superset del CHECK previo).
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_allowed;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_allowed
  CHECK (role::text IN ('admin','coach','family','senior','staff'));

-- 2. Ampliar los tipos de canal admitidos en team_messages con los canales de rol.
--    Los canales de rol no van asociados a ningún equipo (team_id IS NULL).
ALTER TABLE public.team_messages DROP CONSTRAINT IF EXISTS team_messages_channel_type_check;
ALTER TABLE public.team_messages
  ADD CONSTRAINT team_messages_channel_type_check
  CHECK (channel_type IN ('team','family','broadcast','admins','coaches','staff'));

-- 3. Tabla de configuración/estado de cada canal de chat.
--    channel_key reproduce el id de canal usado en el cliente:
--      team-<uuid> · family-<uuid> · broadcast · admins · coaches · staff
--    La ausencia de fila equivale a "activo y abierto" (comportamiento por defecto,
--    compatible con el estado actual de la app).
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('team','family','broadcast','admins','coaches','staff')),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_channels_kind_team_idx ON public.chat_channels(kind, team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer la configuración (necesario para que el cliente
-- sepa qué canales mostrar / si son de solo lectura). Solo el admin la modifica.
DROP POLICY IF EXISTS "chat_channels_select" ON public.chat_channels;
CREATE POLICY "chat_channels_select" ON public.chat_channels FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_channels_admin_all" ON public.chat_channels;
CREATE POLICY "chat_channels_admin_all" ON public.chat_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS chat_channels_set_updated_at ON public.chat_channels;
CREATE TRIGGER chat_channels_set_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Helper: ¿el canal admite escritura ahora mismo? (activo y estado 'open').
--    Ausencia de fila → true (abierto por defecto).
CREATE OR REPLACE FUNCTION public.chat_channel_open(_kind text, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.kind = _kind
      AND cc.team_id IS NOT DISTINCT FROM _team_id
      AND (cc.enabled = false OR cc.status <> 'open')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.chat_channel_open(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_channel_open(text, uuid) TO authenticated;

-- 5. Ampliar el control de acceso por canal con los canales de rol.
--    (El admin ya obtiene true en la 2ª rama para cualquier canal.)
CREATE OR REPLACE FUNCTION public.user_can_access_team_channel(_user_id UUID, _team_id UUID, _channel TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _channel = 'broadcast' THEN true
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN _channel = 'admins' THEN public.has_role(_user_id, 'admin')
    WHEN _channel = 'coaches' THEN public.has_role(_user_id, 'coach')
    WHEN _channel = 'staff' THEN public.has_role(_user_id, 'staff')
    WHEN _team_id IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM public.coach_teams ct WHERE ct.user_id = _user_id AND ct.team_id = _team_id::text) THEN true
    WHEN _channel = 'family' AND EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.families_meta f ON f.id = p.family_id
      WHERE p.team_id = _team_id::text AND f.head_profile_id = _user_id
    ) THEN true
    WHEN _channel = 'team' AND EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.players p ON p.team_id = t.id::text
      JOIN public.families_meta f ON f.id = p.family_id
      WHERE t.id = _team_id AND f.head_profile_id = _user_id AND COALESCE(t.age_category,'U14+') <> 'U12'
    ) THEN true
    ELSE false
  END;
$$;
-- Mantiene la restricción de ejecución previa (revocada de authenticated); las
-- políticas RLS pueden invocarla igualmente.
REVOKE EXECUTE ON FUNCTION public.user_can_access_team_channel(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 6. La inserción de mensajes exige además que el canal esté abierto.
DROP POLICY IF EXISTS "team_messages_insert" ON public.team_messages;
CREATE POLICY "team_messages_insert" ON public.team_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.user_can_access_team_channel(auth.uid(), team_id, channel_type)
    AND public.chat_channel_open(channel_type, team_id)
    AND (
      channel_type <> 'broadcast'
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.coach_teams WHERE user_id = auth.uid())
    )
  );

-- 7. El administrador puede eliminar mensajes (necesario para "eliminar chat").
GRANT DELETE ON public.team_messages TO authenticated;
DROP POLICY IF EXISTS "team_messages_delete_admin" ON public.team_messages;
CREATE POLICY "team_messages_delete_admin" ON public.team_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT DELETE ON public.private_messages TO authenticated;
DROP POLICY IF EXISTS "private_messages_delete_admin" ON public.private_messages;
CREATE POLICY "private_messages_delete_admin" ON public.private_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
