-- Corrige el bug que impedía leer/enviar mensajes de chat: la migración de
-- gestión de chats de admin revocó el permiso de ejecución de esta función
-- para usuarios normales, rompiendo la política de lectura de team_messages.
GRANT EXECUTE ON FUNCTION public.user_can_access_team_channel(uuid, uuid, text) TO authenticated;