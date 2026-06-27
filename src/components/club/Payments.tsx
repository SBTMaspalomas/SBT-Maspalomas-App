import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function PaymentsAdmin() {
  const players = useClub((s) => s.players);
  const teams = useClub((s) => s.teams);

  const toggleUnico = (id: string, checked: boolean) => {
    clubStore.set((s) => {
      const p = s.players.find((x) => x.id === id);
      if (!p) return;
      p.payments = p.payments.map((pm) => ({ ...pm, paid: checked }));
    });
    toast.success(checked ? "Marcado como Pago Único — 3 plazos pagados" : "Pagos reiniciados");
  };

  const togglePeriod = (pid: string, period: string) => {
    clubStore.set((s) => {
      const p = s.players.find((x) => x.id === pid);
      if (!p) return;
      const pm = p.payments.find((x) => x.period === period);
      if (pm) pm.paid = !pm.paid;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuotas y Pagos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.name}</div>
            {players.filter((p) => p.teamId === t.id).map((p) => {
              const allPaid = p.payments.every((x) => x.paid);
              return (
                <div key={p.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.firstName} {p.lastName}</div>
                      <div className="text-xs text-muted-foreground">3 cuotas anuales · Sep / Nov / Feb</div>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      Pago Único
                      <Switch checked={allPaid} onCheckedChange={(v) => toggleUnico(p.id, v)} />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {p.payments.map((pm) => (
                      <button
                        key={pm.period}
                        onClick={() => togglePeriod(p.id, pm.period)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${pm.paid ? "border-success/40 bg-success/15 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
                      >
                        {pm.period}: {pm.paid ? "Pagado" : "Pendiente"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PaymentsParent() {
  const user = useClub(currentUser);
  const player = useClub((s) => s.players.find((p) => p.parentId === user.id));
  const iban = useClub((s) => s.clubIban);
  const bizum = useClub((s) => s.clubBizum);
  if (!player) return null;
  const allPaid = player.payments.every((x) => x.paid);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Mi estado de cuenta</span>
          <Badge className={allPaid ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
            {allPaid ? "Al día" : "Pagos pendientes"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">Jugador: <span className="text-foreground font-medium">{player.firstName} {player.lastName}</span></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {player.payments.map((pm) => (
            <div key={pm.period} className={`rounded-lg border p-3 ${pm.paid ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
              <div className="text-xs uppercase text-muted-foreground">{pm.period}</div>
              <div className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${pm.paid ? "text-success" : "text-destructive"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${pm.paid ? "bg-success" : "bg-destructive"}`} />
                {pm.paid ? "Pagado" : "Pendiente"}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div className="text-sm font-semibold">Datos de pago del club</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">IBAN</span>
            <button onClick={() => { navigator.clipboard?.writeText(iban); toast.success("IBAN copiado"); }} className="flex items-center gap-1 font-mono">
              {iban} <Copy className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bizum</span>
            <button onClick={() => { navigator.clipboard?.writeText(bizum); toast.success("Bizum copiado"); }} className="flex items-center gap-1 font-mono">
              {bizum} <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-border bg-surface px-3 py-2.5 text-sm hover:border-primary">
          <span className="flex items-center gap-2 text-muted-foreground"><Upload className="h-4 w-4" /> Subir justificante de pago</span>
          <CheckCircle2 className="h-4 w-4 text-success opacity-0" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && toast.success(`Justificante "${e.target.files[0].name}" enviado al admin`)} />
        </label>
      </CardContent>
    </Card>
  );
}
