import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, RefreshCw, Wallet } from "lucide-react";

// ==================== MODELO DE CUOTAS ====================
// Tres tipos de cuota según el equipo/actividad del jugador:
//  - "senior"   → jugadores del equipo SENIOR
//  - "federado" → jugadores de los equipos NO SENIOR (federados)
//  - "escuela"  → participantes en la ESCUELA
//
// Dos modalidades de pago:
//  - Pago único: un solo abono en septiembre (con descuento).
//  - Tres plazos: septiembre / noviembre / febrero.
//
// Los importes NO están hardcodeados: se guardan en la tabla `fee_schedules` y los
// edita el administrador. Los valores de abajo (DEFAULT_FEE_SCHEDULES) solo se usan
// como respaldo si la tabla aún no existe o no se pudo leer.
export type FeeType = "senior" | "federado" | "escuela";

export interface FeeSchedule {
  type: FeeType;
  label: string;
  /** Importe del pago único (primer plazo). */
  single: number;
  /** Importe de cada plazo. */
  installments: [number, number, number];
  /** Fecha límite de cada plazo. */
  deadlines: [string, string, string];
}

export const FEE_TYPE_ORDER: FeeType[] = ["senior", "federado", "escuela"];

export const DEFAULT_FEE_SCHEDULES: Record<FeeType, FeeSchedule> = {
  senior: { type: "senior", label: "senior", single: 120, installments: [50, 50, 50], deadlines: ["15 Sep", "15 Nov", "15 Feb"] },
  federado: { type: "federado", label: "federado", single: 390, installments: [175, 125, 125], deadlines: ["15 Sep", "15 Nov", "15 Feb"] },
  escuela: { type: "escuela", label: "escuela", single: 245, installments: [100, 90, 90], deadlines: ["15 Sep", "15 Nov", "15 Feb"] },
};

/**
 * Deriva el tipo de cuota a partir de la categoría (texto libre) del equipo.
 * Heurística sencilla y fácil de ajustar según cómo se nombren las categorías:
 *  - Contiene "senior"  → cuota Senior.
 *  - Contiene "escuela"/"baby"/"chupet"/"prebenjamín" → cuota Escuela.
 *  - Cualquier otra categoría → cuota Federado.
 */
export function feeTypeForCategory(category: string | null | undefined): FeeType {
  const c = (category ?? "").toLowerCase();
  if (/s[eé]nior/.test(c)) return "senior";
  if (/escuela|baby.?basket|chupet|pre.?benjam/.test(c)) return "escuela";
  return "federado";
}

// ==================== ACCESO A DATOS ====================
interface FeeRow {
  fee_type: string;
  label: string;
  single_amount: number | string;
  installment_1: number | string;
  installment_2: number | string;
  installment_3: number | string;
  deadline_1: string;
  deadline_2: string;
  deadline_3: string;
}

function rowToSchedule(row: FeeRow): FeeSchedule {
  return {
    type: row.fee_type as FeeType,
    label: row.label,
    single: Number(row.single_amount),
    installments: [Number(row.installment_1), Number(row.installment_2), Number(row.installment_3)],
    deadlines: [row.deadline_1, row.deadline_2, row.deadline_3],
  };
}

/**
 * Carga las cuotas desde `fee_schedules`, fusionándolas sobre los valores por defecto.
 * Si la tabla no existe o falla la lectura, devuelve los valores por defecto.
 */
export function useFeeSchedules() {
  const [schedules, setSchedules] = useState<Record<FeeType, FeeSchedule>>(DEFAULT_FEE_SCHEDULES);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    // La tabla puede no estar en los tipos generados; se accede con cast (patrón del repo).
    const { data, error } = await supabase.from("fee_schedules" as never).select("*");
    if (!error && Array.isArray(data)) {
      const merged: Record<FeeType, FeeSchedule> = { ...DEFAULT_FEE_SCHEDULES };
      for (const row of data as unknown as FeeRow[]) {
        const t = row.fee_type as FeeType;
        if (t in merged) merged[t] = rowToSchedule(row);
      }
      setSchedules(merged);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { schedules, loading, reload };
}

// ==================== TARJETA DE CUOTA (VISTA) ====================
function fmt(v: number | null): string {
  return v == null ? "—" : `${v}€`;
}

function CuotaCard({ schedule }: { schedule: FeeSchedule }) {
  const rows: { label: string; values: (number | null)[] }[] = [
    { label: "Pago único", values: [schedule.single, null, null] },
    { label: "Tres pagos", values: [...schedule.installments] },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Título: siempre "CUOTA ANUAL", con el tipo de forma discreta. */}
      <div className="flex items-baseline justify-between border-b border-border bg-surface px-4 py-3">
        <h3 className="text-sm font-black uppercase tracking-wider">Cuota anual</h3>
        <span className="text-xs text-muted-foreground">({schedule.label})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Fecha límite</th>
              {schedule.deadlines.map((d, i) => (
                <th key={i} className="px-3 py-2 text-right font-medium tabular-nums">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">{fmt(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Muestra la(s) tarjeta(s) de "Cuota anual" correspondientes a los tipos de cuota
 * recibidos. A un adulto responsable solo se le presentan las cuotas del/los
 * equipo(s) principal(es) de su(s) hijo(s); si no hay ninguna, no se renderiza nada
 * (a cualquier otro adulto no se le hace referencia a cuotas).
 */
export function CuotaAnual({ types }: { types: FeeType[] }) {
  const { schedules } = useFeeSchedules();
  const unique = FEE_TYPE_ORDER.filter((t) => types.includes(t));

  if (unique.length === 0) return null;

  return (
    <div className="space-y-3">
      {unique.map((t) => (
        <CuotaCard key={t} schedule={schedules[t]} />
      ))}
    </div>
  );
}

// ==================== EDITOR (ADMIN) ====================
type FeeForm = {
  label: string;
  single: string;
  installments: [string, string, string];
  deadlines: [string, string, string];
};

function scheduleToForm(s: FeeSchedule): FeeForm {
  return {
    label: s.label,
    single: String(s.single),
    installments: [String(s.installments[0]), String(s.installments[1]), String(s.installments[2])],
    deadlines: [...s.deadlines],
  };
}

const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Editor de cuotas para el administrador. Carga los valores actuales y permite
 * modificar importes y fechas límite de cada tipo de cuota, guardándolos en
 * `fee_schedules` (upsert por `fee_type`).
 */
export function FeeSchedulesEditor() {
  const { schedules, loading, reload } = useFeeSchedules();
  const [forms, setForms] = useState<Record<FeeType, FeeForm> | null>(null);
  const [saving, setSaving] = useState(false);

  // Inicializar el formulario cuando terminan de cargar las cuotas.
  useEffect(() => {
    if (!loading) {
      setForms({
        senior: scheduleToForm(schedules.senior),
        federado: scheduleToForm(schedules.federado),
        escuela: scheduleToForm(schedules.escuela),
      });
    }
  }, [loading, schedules]);

  const update = (type: FeeType, patch: Partial<FeeForm>) => {
    setForms((prev) => (prev ? { ...prev, [type]: { ...prev[type], ...patch } } : prev));
  };

  const handleSave = async () => {
    if (!forms) return;

    // Validar importes.
    for (const t of FEE_TYPE_ORDER) {
      const f = forms[t];
      const amounts = [num(f.single), num(f.installments[0]), num(f.installments[1]), num(f.installments[2])];
      if (amounts.some((n) => Number.isNaN(n))) {
        toast.error(`Importes inválidos en la cuota "${f.label || t}"`);
        return;
      }
    }

    setSaving(true);
    const payload = FEE_TYPE_ORDER.map((t) => {
      const f = forms[t];
      return {
        fee_type: t,
        label: f.label.trim() || t,
        single_amount: num(f.single),
        installment_1: num(f.installments[0]),
        installment_2: num(f.installments[1]),
        installment_3: num(f.installments[2]),
        deadline_1: f.deadlines[0].trim(),
        deadline_2: f.deadlines[1].trim(),
        deadline_3: f.deadlines[2].trim(),
      };
    });

    const { error } = await supabase
      .from("fee_schedules" as never)
      .upsert(payload as never, { onConflict: "fee_type" });

    setSaving(false);
    if (error) {
      toast.error("Error al guardar las cuotas");
      return;
    }
    toast.success("Cuotas actualizadas");
    reload();
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
          <Wallet className="h-4 w-4 text-primary" />
          Configuración de cuotas
        </h3>
        <Button variant="outline" size="icon" onClick={reload} disabled={loading} title="Recargar">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {!forms ? (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando cuotas...</p>
        ) : (
          <>
            {FEE_TYPE_ORDER.map((t) => {
              const f = forms[t];
              return (
                <div key={t} className="rounded-lg border border-border p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary">{t}</span>
                    <Input
                      className="h-7 max-w-[180px] text-xs"
                      value={f.label}
                      onChange={(e) => update(t, { label: e.target.value })}
                      placeholder="Etiqueta visible"
                    />
                  </div>

                  <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 text-sm">
                    <div className="text-xs text-muted-foreground">Fecha límite</div>
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={`d-${i}`}
                        className="h-8 text-center text-xs"
                        value={f.deadlines[i]}
                        onChange={(e) => {
                          const next = [...f.deadlines] as [string, string, string];
                          next[i] = e.target.value;
                          update(t, { deadlines: next });
                        }}
                        placeholder="15 Sep"
                      />
                    ))}

                    <div className="text-xs text-muted-foreground">Pago único (€)</div>
                    <Input
                      className="h-8 text-center tabular-nums"
                      inputMode="decimal"
                      value={f.single}
                      onChange={(e) => update(t, { single: e.target.value })}
                    />
                    <div className="text-center text-xs text-muted-foreground">—</div>
                    <div className="text-center text-xs text-muted-foreground">—</div>

                    <div className="text-xs text-muted-foreground">Tres pagos (€)</div>
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={`p-${i}`}
                        className="h-8 text-center tabular-nums"
                        inputMode="decimal"
                        value={f.installments[i]}
                        onChange={(e) => {
                          const next = [...f.installments] as [string, string, string];
                          next[i] = e.target.value;
                          update(t, { installments: next });
                        }}
                      />
                    ))}
                  </div>

                  <div className="mt-2 text-right text-xs text-muted-foreground">
                    Total a plazos: <span className="font-semibold text-foreground tabular-nums">
                      {(num(f.installments[0]) + num(f.installments[1]) + num(f.installments[2])) || 0}€
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
