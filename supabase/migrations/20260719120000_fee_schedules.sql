-- Cuotas configurables por el administrador.
-- Cada fila define, para un tipo de cuota (senior / federado / escuela), el importe
-- del pago único y de los tres plazos, junto con sus fechas límite. Sustituye a los
-- importes que antes estaban hardcodeados en el frontend.
CREATE TABLE IF NOT EXISTS public.fee_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  single_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
  installment_1 NUMERIC(8,2) NOT NULL DEFAULT 0,
  installment_2 NUMERIC(8,2) NOT NULL DEFAULT 0,
  installment_3 NUMERIC(8,2) NOT NULL DEFAULT 0,
  deadline_1 TEXT NOT NULL DEFAULT '15 Sep',
  deadline_2 TEXT NOT NULL DEFAULT '15 Nov',
  deadline_3 TEXT NOT NULL DEFAULT '15 Feb',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_schedules TO authenticated;
GRANT ALL ON public.fee_schedules TO service_role;

ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;

-- Solo el administrador puede crear/editar/eliminar cuotas.
CREATE POLICY fee_schedules_admin_all ON public.fee_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Cualquier usuario autenticado puede consultarlas (para mostrar la cuota anual).
CREATE POLICY fee_schedules_select_all_auth ON public.fee_schedules FOR SELECT TO authenticated USING (true);

CREATE TRIGGER fee_schedules_updated_at BEFORE UPDATE ON public.fee_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Valores iniciales (los que estaban hardcodeados). El pago único aplica un descuento
-- sobre el total a plazos: Senior −30 €, Federado −35 €, Escuela −35 €.
INSERT INTO public.fee_schedules (fee_type, label, single_amount, installment_1, installment_2, installment_3)
VALUES
  ('senior',   'senior',   120, 50,  50,  50),
  ('federado', 'federado', 390, 175, 125, 125),
  ('escuela',  'escuela',  245, 100, 90,  90)
ON CONFLICT (fee_type) DO NOTHING;
