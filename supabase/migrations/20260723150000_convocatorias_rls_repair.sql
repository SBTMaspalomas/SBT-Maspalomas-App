-- =============================================================================
-- FIX · "Error al crear convocatoria" — re-asserta las políticas RLS de
-- `convocatorias` de forma robusta.
--
-- La tabla `convocatorias` NO se creó con una migración: existía en la BD viva
-- (Lovable) y se "versionó" a posteriori (20260721090300) con
-- `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS "convocatorias_manage"`.
-- Ese `DROP ... IF EXISTS` sólo elimina una política que se llame EXACTAMENTE
-- "convocatorias_manage"; si la política original de Lovable tenía otro nombre
-- (p. ej. un INSERT restrictivo o un WITH CHECK distinto), quedó viva en la BD
-- y puede rechazar el INSERT del panel del entrenador aunque el usuario sea
-- admin/coach — que es justo el síntoma reportado.
--
-- Esta migración elimina TODAS las políticas actuales de `convocatorias`
-- (cualquiera que sea su nombre) y recrea únicamente las dos canónicas, de modo
-- que el estado de RLS quede determinista e igual al descrito en el repo.
-- ADITIVO, IDEMPOTENTE y sin pérdida de datos.
-- =============================================================================

ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatorias TO authenticated;

-- Elimina cualquier política preexistente sobre la tabla (nombres desconocidos
-- incluidos) para partir de un estado limpio.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'convocatorias'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.convocatorias', pol.policyname);
  END LOOP;
END $$;

-- Gestión (crear/editar/borrar): admin y coach. WITH CHECK obliga a firmar la
-- fila con el propio uid (created_by = auth.uid()).
CREATE POLICY "convocatorias_manage"
  ON public.convocatorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
  );

-- Lectura: cualquier autenticado (jugadores, familias, senior, staff…).
CREATE POLICY "convocatorias_select_all_auth"
  ON public.convocatorias FOR SELECT TO authenticated
  USING (true);
