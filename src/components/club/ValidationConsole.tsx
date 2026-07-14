import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileText, Download, User, Users, RefreshCw } from "lucide-react";

interface Registration {
  id: string;
  user_id: string;
  type: string; // 'adult' | 'minor'
  full_name: string;
  doc_type: string;
  doc_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  dni_front_url: string | null;
  dni_back_url: string | null;
  signature_url: string | null;
  auth_image: boolean;
  auth_travel: boolean;
  auth_medical: boolean;
  auth_data_sharing: boolean;
  doc_status: string;
  reject_reason: string | null;
  family_id: string | null;
  parent_registration_id: string | null;
  created_at: string;
}

const statusUI = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "Aprobado", cls: "bg-green-500/10 text-green-400 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rechazado", cls: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
};
const defaultStatus = { label: "Sin estado", cls: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: Clock };

export function ValidationConsole() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const selected = registrations.find((r) => r.id === openId);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar registros");
      setLoading(false);
      return;
    }
    setRegistrations((data || []) as Registration[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: "pending" | "approved" | "rejected", rejectReason?: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("registrations")
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
    load();
  };

  const filtered = filter === "all" ? registrations : registrations.filter((r) => r.doc_status === filter);
  const pendingCount = registrations.filter((r) => r.doc_status === "pending").length;
  const approvedCount = registrations.filter((r) => r.doc_status === "approved").length;
  const rejectedCount = registrations.filter((r) => r.doc_status === "rejected").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Validación de Documentos</h2>
          <p className="text-sm text-muted-foreground">{registrations.length} registro{registrations.length !== 1 ? "s" : ""} en total</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={`cursor-pointer ${filter === "all" ? "bg-primary/10 text-primary border-primary" : ""}`} onClick={() => setFilter("all")}>
          Todos: {registrations.length}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "pending" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" : ""}`} onClick={() => setFilter("pending")}>
          <Clock className="h-3 w-3 mr-1" />
          Pendientes: {pendingCount}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "approved" ? "bg-green-500/10 text-green-400 border-green-500/30" : ""}`} onClick={() => setFilter("approved")}>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aprobados: {approvedCount}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/30" : ""}`} onClick={() => setFilter("rejected")}>
          <XCircle className="h-3 w-3 mr-1" />
          Rechazados: {rejectedCount}
        </Badge>
      </div>

      {/* Registrations List */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Cargando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No hay registros {filter !== "all" ? `con estado "${statusUI[filter]?.label}"` : ""}</p>
            </div>
          ) : (
            filtered.map((r) => {
              const S = statusUI[r.doc_status as keyof typeof statusUI] || defaultStatus;
              const Icon = S.icon;
              const TypeIcon = r.type === "adult" ? User : Users;
              return (
                <button
                  key={r.id}
                  onClick={() => { setOpenId(r.id); setReason(r.reject_reason || ""); }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-primary/5 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.type === "adult" ? "Adulto" : "Menor"} · {r.doc_type} · {r.doc_number || "—"} · {new Date(r.created_at).toLocaleDateString("es-ES")}
                      </div>
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
            <DialogTitle>{selected?.full_name} <span className="text-sm font-normal text-muted-foreground">({selected?.type === "adult" ? "Adulto" : "Menor"})</span></DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo de documento:</span>
                  <p className="font-medium">{selected.doc_type || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Número:</span>
                  <p className="font-medium">{selected.doc_number || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha de nacimiento:</span>
                  <p className="font-medium">{selected.birth_date ? new Date(selected.birth_date).toLocaleDateString("es-ES") : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registrado:</span>
                  <p className="font-medium">{new Date(selected.created_at).toLocaleDateString("es-ES")}</p>
                </div>
                {selected.phone && (
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <p className="font-medium">{selected.phone}</p>
                  </div>
                )}
                {selected.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selected.email}</p>
                  </div>
                )}
              </div>

              {/* Autorizaciones */}
              <div className="space-y-1">
                <h3 className="font-medium text-sm">Autorizaciones</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className={selected.auth_data_sharing ? "text-green-400" : "text-red-400"}>
                    {selected.auth_data_sharing ? "✓" : "✗"} Compartir datos (obligatoria)
                  </div>
                  <div className={selected.auth_image ? "text-green-400" : "text-muted-foreground"}>
                    {selected.auth_image ? "✓" : "✗"} Imagen
                  </div>
                  <div className={selected.auth_travel ? "text-green-400" : "text-muted-foreground"}>
                    {selected.auth_travel ? "✓" : "✗"} Transporte
                  </div>
                  <div className={selected.auth_medical ? "text-green-400" : "text-muted-foreground"}>
                    {selected.auth_medical ? "✓" : "✗"} Asistencia médica
                  </div>
                </div>
              </div>

              {/* Documents Grid */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Documentos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ["Foto", selected.photo_url],
                    ["DNI anverso", selected.dni_front_url],
                    ["DNI reverso", selected.dni_back_url],
                  ].map(([label, url]) => (
                    <div key={label as string} className="rounded-lg border border-border bg-background p-2">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label as string}</div>
                      {url ? (
                        <div className="relative group">
                          <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted overflow-hidden">
                            <img src={url as string} alt={label as string} className="w-full h-full object-cover rounded" />
                          </div>
                          <a href={url as string} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded">
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
              {selected.signature_url && (
                <div>
                  <h3 className="font-medium text-sm mb-2">Firma</h3>
                  <img src={selected.signature_url} alt="firma" className="h-24 rounded border border-border bg-white p-1" />
                </div>
              )}

              {/* Reject Reason */}
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
                <Button variant="outline" onClick={() => updateStatus(selected.id, "pending")} disabled={savingId === selected.id}>
                  <Clock className="mr-2 h-4 w-4" />
                  Pendiente
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(selected.id, "approved")} disabled={savingId === selected.id}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
                <Button variant="destructive" onClick={() => updateStatus(selected.id, "rejected", reason || "Sin motivo especificado")} disabled={savingId === selected.id}>
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
