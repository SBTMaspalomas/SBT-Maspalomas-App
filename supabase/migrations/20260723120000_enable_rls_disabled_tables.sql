-- =============================================================================
-- Reactiva Row Level Security (RLS) en las tablas marcadas como UNRESTRICTED.
--
-- El linter de seguridad de Supabase reporta dos errores en estas tablas:
--   * 0007_policy_exists_rls_disabled  -> tienen políticas pero RLS apagado.
--   * 0013_rls_disabled_in_public      -> tabla pública sin RLS habilitado.
--
-- Todas estas tablas se crearon originalmente con `ENABLE ROW LEVEL SECURITY`,
-- pero el estado real de la base de datos divergió (RLS se desactivó desde el
-- dashboard), dejándolas accesibles sin restricción a través de PostgREST pese
-- a tener políticas definidas. Las políticas ya existen: basta con volver a
-- habilitar RLS para que vuelvan a aplicarse.
--
-- ADITIVO e IDEMPOTENTE: habilitar RLS cuando ya está habilitado es un no-op.
-- =============================================================================

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
