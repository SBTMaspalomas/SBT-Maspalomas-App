import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileText, Image as ImageIcon, Download } from "lucide-react";

interface PlayerRegistration {
  id: string;
  full_name: string;
  birth_date: string;
  doc_type: string;
  doc_number: string;
  doc_status: "pending" | "approved" | "rejected";
  reject_reason?: string;
  photo_url?: string;
  dni_front_url?: string;
  dni_back_url?: string;
  tutor_dni_front_url?: string;
  tutor_dni_back_url?: string;
  federativa_pdf_url?: string;
  signature_url?: string;
  created_at: string;
  family_id?: string;
}

const statusUI = {
  pending: { label: "Pendiente", cls: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  approved: { label: "Aprobado", cls: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "Rechazado", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

export function ValidationConsole() {
  const [players, setPlayers] = useState<PlayerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const player = players.find((p) => p.id === openId);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar jugadores");
      setLoading(false);
      return;
    }

    setPlayers((data || []) as PlayerRegistration[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const updateStatus = async (id: string, status: "pending" | "approved" | "rejected", rejectReason?: string) => {
    setSavingId(id);

    const { error } = await supabase
      .from("players")
      .update({
        doc_status: status,
        reject_reason: status === "rejected" ? rejectReason : null,
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar estado");
      setSavingId(null);
      return;
    }

    toast.success(`Estado actualizado a ${statusUI[status].label}`);
    setSavingId(null);
    setOpenId(null);
    setReason("");
    loadPlayers();
  };

  const pendingCount = players.filter((p) => p.doc_status === "pending").length;
  const approvedCount = players.filter((p) => p.doc_status === "approved").length;
  const rejectedCount = players.filter((p) => p.doc_status === "rejected").length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div>
        <h2 className="text-lg font-bold">Validación de Documentos</h2>
        <div className="mt-2 flex gap-2">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pendientes: {pendingCount}
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprobados: {approvedCount}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazados: {rejectedCount}
          </Badge>
        </div>
      </div>

      {/* Players List */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No hay registros</p>
            </div>
          ) : (
            players.map((p) => {
              const S = statusUI[p.doc_status];
              const Icon = S.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setOpenId(p.id);
                    setReason(p.reject_reason || "");
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-primary/5 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.doc_type} · {p.doc_number || "—"} · {new Date(p.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${S.cls}`}>
                    <Icon className="mr-1 h-3 w-3" />
                    {S.label}
                  </Badge>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{player ? player.full_name : ""}</DialogTitle>
          </DialogHeader>
          {player && (
            <div className="space-y-4">
              {/* Player Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo de documento:</span>
                  <p className="font-medium">{player.doc_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Número:</span>
                  <p className="font-medium">{player.doc_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha de nacimiento:</span>
                  <p className="font-medium">{new Date(player.birth_date).toLocaleDateString("es-ES")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registrado:</span>
                  <p className="font-medium">{new Date(player.created_at).toLocaleDateString("es-ES")}</p>
                </div>
              </div>

              {/* Documents Grid */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Documentos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ["Foto carnet", player.photo_url, "img"],
                    ["DNI anverso", player.dni_front_url, "img"],
                    ["DNI reverso", player.dni_back_url, "img"],
                    ["DNI tutor anv.", player.tutor_dni_front_url, "img"],
                    ["DNI tutor rev.", player.tutor_dni_back_url, "img"],
                    ["Ficha federativa", player.federativa_pdf_url, "pdf"],
                  ].map(([label, url, type]) => (
                    <div key={label as string} className="rounded-lg border border-border bg-background p-2">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label as string}</div>
                      {url ? (
                        <div className="relative group">
                          <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted">
                            {type === "pdf" ? (
                              <FileText className="h-8 w-8 text-primary" />
                            ) : (
                              <img src={url} alt={label as string} className="w-full h-full object-cover rounded" />
                            )}
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded"
                          >
                            <Download className="h-4 w-4 text-white" />
                          </a>
                        </div>
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted text-muted-foreground text-xs">
                          No aportado
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Signature */}
              {player.signature_url && (
                <div>
                  <h3 className="font-medium text-sm mb-2">Firma del tutor</h3>
                  <img src={player.signature_url} alt="firma" className="h-24 rounded border border-border bg-white p-1" />
                </div>
              )}

              {/* Reject Reason Input */}
              <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-medium">Motivo del rechazo (si aplica)</div>
                <Input
                  placeholder="Ej: DNI ilegible, falta documento..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateStatus(player.id, "pending")}
                  disabled={savingId === player.id}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Pendiente
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus(player.id, "approved")}
                  disabled={savingId === player.id}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateStatus(player.id, "rejected", reason || "Sin motivo especificado")}
                  disabled={savingId === player.id}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
