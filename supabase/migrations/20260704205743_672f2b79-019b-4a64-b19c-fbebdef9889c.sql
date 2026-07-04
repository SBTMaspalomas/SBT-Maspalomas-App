
-- Add 'family' to app_role enum (must be a standalone migration to be usable afterwards)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'family';

-- Restrict SECURITY DEFINER helper functions to service_role only
REVOKE ALL ON FUNCTION public.compute_family_reference_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_family_reference_code(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_family_reference_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_family_reference_code() TO service_role;
