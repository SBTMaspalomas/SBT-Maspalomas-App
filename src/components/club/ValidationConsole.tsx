import { useState } from "react";
import { clubStore, useClub, type DocStatus } from "@/lib/clubStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Clock, FileText, Image as ImageIcon } from "lucide-react";

const statusUI: Record<DocStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", cls: "bg-warning/15 text-warning border-warning/40", icon: Clock },
  approved: { label: "Aprobado", cls: "bg-success/15 text-success border-success/40", icon: CheckCircle2 },
  rejected: { label: "Rechazado", cls: "bg-destructive/15 text-destructive border-destructive/40", icon: XCircle },
};

export function ValidationConsole() {
  const players = useClub((s) => s.players);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const player = players.find((p) => p.id === openId);

  const setStatus = (id: string, status: DocStatus, why?: string) => {
    clubStore.set((s) => {
      const p = s.players.find((x) => x.id === id);
      if (!p) return;
      p.docStatus = status;
      p.rejectReason = status === "rejected" ? why : undefined;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consola de Validación Documental</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {players.map((p) => {
          const S = statusUI[p.docStatus];
          return (
            <button
              key={p.id}
              onClick={() => { setOpenId(p.id); setReason(p.rejectReason ?? ""); }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:border-primary"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{p.firstName} {p.lastName}</div>
                <div className="text-xs text-muted-foreground">{p.docType} · {p.docNumber || "—"}</div>
              </div>
              <Badge variant="outline" className={`shrink-0 ${S.cls}`}>
                <S.icon className="mr-1 h-3 w-3" /> {S.label}
              </Badge>
            </button>
          );
        })}
      </CardContent>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{player ? `${player.firstName} ${player.lastName}` : ""}</DialogTitle>
          </DialogHeader>
          {player && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Foto carnet", player.photo, "img"],
                  ["DNI anverso", player.dniFront, "img"],
                  ["DNI reverso", player.dniBack, "img"],
                  ["DNI tutor anv.", player.tutorDniFront, "img"],
                  ["DNI tutor rev.", player.tutorDniBack, "img"],
                  ["Ficha federativa", player.federativaPdf, "pdf"],
                ].map(([label, val, kind]) => (
                  <div key={label as string} className="rounded-lg border border-border bg-surface p-2">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label as string}</div>
                    <div className="flex aspect-[4/3] items-center justify-center rounded bg-background text-muted-foreground">
                      {val ? (kind === "pdf" ? <FileText className="h-8 w-8 text-primary" /> : <ImageIcon className="h-8 w-8 text-primary" />) : <span className="text-xs">—</span>}
                    </div>
                    <div className="mt-1 truncate text-xs">{(val as string) || "no aportado"}</div>
                  </div>
                ))}
              </div>
              {player.signature && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Firma del tutor</div>
                  <img src={player.signature} alt="firma" className="h-20 rounded bg-white p-1" />
                </div>
              )}
              <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                <div className="text-sm font-medium">Motivo del rechazo</div>
                <Input placeholder="Ej: DNI ilegible..." value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setStatus(player.id, "pending"); }}>
                  <Clock className="mr-2 h-4 w-4" /> Pendiente
                </Button>
                <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => { setStatus(player.id, "approved"); setOpenId(null); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                </Button>
                <Button variant="destructive" onClick={() => { setStatus(player.id, "rejected", reason || "Sin motivo"); setOpenId(null); }}>
                  <XCircle className="mr-2 h-4 w-4" /> Rechazar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
