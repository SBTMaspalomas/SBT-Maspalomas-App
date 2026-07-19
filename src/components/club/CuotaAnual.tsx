import { Card } from "@/components/ui/card";

// ==================== CONFIGURACIÓN DE CUOTAS ====================
// Tres tipos de cuota según el equipo/actividad del jugador:
//  - "senior"   → jugadores del equipo SENIOR
//  - "federado" → jugadores de los equipos NO SENIOR (federados)
//  - "escuela"  → participantes en la ESCUELA
//
// Dos modalidades de pago:
//  - Pago único: un solo abono en septiembre (con descuento).
//  - Tres plazos: septiembre / noviembre / febrero.
//
// Nota sobre importes: el pago único aplica un descuento sobre el total a plazos
// (Senior −30 €, Federado −35 €, Escuela −35 €). Por eso Escuela = 280 − 35 = 245 €.
export type FeeType = "senior" | "federado" | "escuela";

interface FeeSchedule {
  type: FeeType;
  label: string;
  /** Importe del pago único (septiembre). */
  single: number;
  /** Importe de cada plazo: [septiembre, noviembre, febrero]. */
  installments: [number, number, number];
}

export const FEE_SCHEDULES: Record<FeeType, FeeSchedule> = {
  senior: { type: "senior", label: "senior", single: 120, installments: [50, 50, 50] },
  federado: { type: "federado", label: "federado", single: 390, installments: [175, 125, 125] },
  escuela: { type: "escuela", label: "escuela", single: 245, installments: [100, 90, 90] },
};

/** Fechas límite de cada plazo (15 de cada mes). */
const DEADLINES = ["15 Sep", "15 Nov", "15 Feb"];

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

// ==================== TARJETA DE CUOTA ====================
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
              {DEADLINES.map((d) => (
                <th key={d} className="px-3 py-2 text-right font-medium tabular-nums">{d}</th>
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
  // Dedup preservando un orden estable: senior, federado, escuela.
  const order: FeeType[] = ["senior", "federado", "escuela"];
  const unique = order.filter((t) => types.includes(t));

  if (unique.length === 0) return null;

  return (
    <div className="space-y-3">
      {unique.map((t) => (
        <CuotaCard key={t} schedule={FEE_SCHEDULES[t]} />
      ))}
    </div>
  );
}
