-- =============================================================================
-- FASE 0 · Saneamiento — versiona la tabla `payments` (cuotas).
--
-- La usa el módulo financiero: PaymentsAdmin (el admin ve todas las cuotas y las
-- marca pagado/pendiente/rechazado) y PaymentsParent (la familia ve las cuotas
-- de su family_id, o el jugador SENIOR las de su player_id, y sube el
-- comprobante). Existía en la BD viva pero no estaba versionada.
-- ADITIVO e IDEMPOTENTE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid,
  player_id uuid,
  player_name text,
  amount numeric NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_family_id_idx ON public.payments(family_id);
CREATE INDEX IF NOT EXISTS payments_player_id_idx ON public.payments(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- El administrador gestiona todas las cuotas (crear, cambiar estado, etc.).
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all"
  ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- La familia (o el jugador SENIOR) ve las cuotas que le corresponden:
--   · por family_id, si es la familia responsable (head_profile_id = auth.uid())
--   · por player_id, si es el propio jugador (players.user_id = auth.uid())
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT TO authenticated
  USING (
    family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
    OR player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
  );

-- La familia / jugador solo puede actualizar sus propias cuotas (subir el
-- comprobante y dejar el estado en 'pending' a la espera de validación).
DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
CREATE POLICY "payments_update_own"
  ON public.payments FOR UPDATE TO authenticated
  USING (
    family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
    OR player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT id FROM public.families_meta WHERE head_profile_id = auth.uid())
    OR player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
  );
