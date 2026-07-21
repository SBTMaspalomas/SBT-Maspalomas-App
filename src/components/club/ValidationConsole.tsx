import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Download, User, Users, RefreshCw, FileText } from "lucide-react";

interface Registration {
  id: string;
  user_id: string;
  type: string;
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
  photo_status: string | null;
  dni_front_status: string | null;
  dni_back_status: string | null;
  signature_status: string | null;
  federativa_pdf_url: string | null;
  federativa_status: string | null;
}

type DocField = "photo_status" | "dni_front_status" | "dni_back_status" | "signature_status" | "federativa_status";
type DocStatus = "pending" | "approved" | "rejected";

const statusUI = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "Aprobado", cls: "bg-green-500/10 text-green-400 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rechazado", cls: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
};
const defaultStatus = { label: "Sin estado", cls: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: Clock };

const DOC_LABELS: Record<DocField, string> = {
  photo_status: "Foto",
  dni_front_status: "DNI Anverso",
  dni_back_status: "DNI Reverso",
  signature_status: "Firma",
  federativa_status: "Ficha Federativa",
};

const DOC_URL_MAP: Record<DocField, keyof Registration> = {
  photo_status: "photo_url",
  dni_front_status: "dni_front_url",
  dni_back_status: "dni_back_url",
  signature_status: "signature_url",
  federativa_status: "federativa_pdf_url",
};

// Documentos que se muestran y validan por registro. La ficha federativa se
// muestra siempre, pero sólo bloquea el estado global cuando ya se ha subido.
const DOC_FIELDS: DocField[] = [
  "photo_status", "dni_front_status", "dni_back_status", "signature_status", "federativa_status",
];

function computeOverallStatus(reg: Registration): DocStatus {
  const fields: DocField[] = ["photo_status", "dni_front_status", "dni_back_status", "signature_status"];
  const statuses = fields.map((f) => reg[f] || "pending");
  // La ficha federativa sólo cuenta para el semáforo global si ya hay PDF subido.
  if (reg.federativa_pdf_url) statuses.push((reg.federativa_status as DocStatus) || "pending");
  if (statuses.some((s) => s === "rejected")) return "rejected";
  if (statuses.every((s) => s === "approved")) return "approved";
  return "pending";
}

export function ValidationConsole() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
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
    setRegistrations((data || []) as unknown as Registration[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateDocStatus = async (id: string, field: DocField, status: DocStatus, rejectReason?: string) => {
    setSavingField(`${id}-${field}`);
    const updateData: TablesUpdate<"registrations"> = { [field]: status };
    if (status === "rejected" && rejectReason) {
      updateData.reject_reason = rejectReason;
    }
    const { error } = await supabase
      .from("registrations")
      .update(updateData)
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar estado del documento");
      setSavingField(null);
      return;
    }

    // Update overall doc_status
    const reg = registrations.find((r) => r.id === id);
    if (reg) {
      const updated = { ...reg, [field]: status };
      const overall = computeOverallStatus(updated);
      await supabase
        .from("registrations")
        .update({ doc_status: overall, ...(status !== "rejected" ? {} : { reject_reason: rejectReason || null }) })
        .eq("id", id);
    }

    toast.success(`${DOC_LABELS[field]}: ${statusUI[status].label}`);
    setSavingField(null);
    load();
  };

  const approveAll = async (id: string) => {
    setSavingField(`${id}-all`);
    const reg = registrations.find((r) => r.id === id);
    const updateData: TablesUpdate<"registrations"> = {
      photo_status: "approved",
      dni_front_status: "approved",
      dni_back_status: "approved",
      signature_status: "approved",
      doc_status: "approved",
      reject_reason: null,
    };
    // Sólo se aprueba la ficha federativa si ya se ha subido el PDF.
    if (reg?.federativa_pdf_url) updateData.federativa_status = "approved";
    const { error } = await supabase
      .from("registrations")
      .update(updateData)
      .eq("id", id);
    if (error) { toast.error("Error"); setSavingField(null); return; }
    toast.success("Todos los documentos aprobados");
    setSavingField(null);
    setOpenId(null);
    load();
  };

  const getOverall = (r: Registration): DocStatus => computeOverallStatus(r);

  const filtered = filter === "all" ? registrations : registrations.filter((r) => getOverall(r) === filter);
  const pendingCount = registrations.filter((r) => getOverall(r) === "pending").length;
  const approvedCount = registrations.filter((r) => getOverall(r) === "approved").length;
  const rejectedCount = registrations.filter((r) => getOverall(r) === "rejected").length;

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

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={`cursor-pointer ${filter === "all" ? "bg-primary/10 text-primary border-primary" : ""}`} onClick={() => setFilter("all")}>
          Todos: {registrations.length}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "pending" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" : ""}`} onClick={() => setFilter("pending")}>
          <Clock className="h-3 w-3 mr-1" /> Pendientes: {pendingCount}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "approved" ? "bg-green-500/10 text-green-400 border-green-500/30" : ""}`} onClick={() => setFilter("approved")}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprobados: {approvedCount}
        </Badge>
        <Badge variant="outline" className={`cursor-pointer ${filter === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/30" : ""}`} onClick={() => setFilter("rejected")}>
          <XCircle className="h-3 w-3 mr-1" /> Rechazados: {rejectedCount}
        </Badge>
      </div>

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
              const overall = getOverall(r);
              const S = statusUI[overall] || defaultStatus;
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
                    <Icon className="mr-1 h-3 w-3" /> {S.label}
                  </Badge>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.full_name} <span className="text-sm font-normal text-muted-foreground">({selected?.type === "adult" ? "Adulto" : "Menor"})</span></DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Documento:</span><p className="font-medium">{selected.doc_type} {selected.doc_number || "—"}</p></div>
                <div><span className="text-muted-foreground">Nacimiento:</span><p className="font-medium">{selected.birth_date ? new Date(selected.birth_date).toLocaleDateString("es-ES") : "—"}</p></div>
                {selected.phone && <div><span className="text-muted-foreground">Teléfono:</span><p className="font-medium">{selected.phone}</p></div>}
                {selected.email && <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{selected.email}</p></div>}
              </div>

              <div className="space-y-1">
                <h3 className="font-medium text-sm">Autorizaciones</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className={selected.auth_data_sharing ? "text-green-400" : "text-red-400"}>{selected.auth_data_sharing ? "✓" : "✗"} Compartir datos</div>
                  <div className={selected.auth_image ? "text-green-400" : "text-muted-foreground"}>{selected.auth_image ? "✓" : "✗"} Imagen</div>
                  <div className={selected.auth_travel ? "text-green-400" : "text-muted-foreground"}>{selected.auth_travel ? "✓" : "✗"} Transporte</div>
                  <div className={selected.auth_medical ? "text-green-400" : "text-muted-foreground"}>{selected.auth_medical ? "✓" : "✗"} Asistencia médica</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-sm">Documentos (aprobación individual)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DOC_FIELDS.map((field) => {
                    const url = selected[DOC_URL_MAP[field]] as string | null;
                    const status = (selected[field] || "pending") as DocStatus;
                    const S = statusUI[status] || defaultStatus;
                    const SIcon = S.icon;
                    const isSaving = savingField === `${selected.id}-${field}`;
                    // La ficha federativa es un PDF: no se puede previsualizar con <img>.
                    const isPdf = field === "federativa_status" || (!!url && url.toLowerCase().endsWith(".pdf"));
                    return (
                      <div key={field} className="rounded-lg border border-border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{DOC_LABELS[field]}</span>
                          <Badge variant="outline" className={`text-[10px] ${S.cls}`}><SIcon className="mr-1 h-2.5 w-2.5" />{S.label}</Badge>
                        </div>
                        {url ? (
                          isPdf ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded bg-muted text-muted-foreground transition hover:text-foreground">
                              <FileText className="h-8 w-8" />
                              <span className="inline-flex items-center gap-1 text-xs"><Download className="h-3 w-3" /> Abrir PDF</span>
                            </a>
                          ) : (
                            <div className="relative group">
                              <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted overflow-hidden">
                                <img src={url} alt={DOC_LABELS[field]} className="w-full h-full object-cover rounded" />
                              </div>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded">
                                <Download className="h-4 w-4 text-white" />
                              </a>
                            </div>
                          )
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted text-muted-foreground text-xs">No aportado</div>
                        )}
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-green-400 border-green-500/30 hover:bg-green-500/10" disabled={isSaving || status === "approved" || !url} onClick={() => updateDocStatus(selected.id, field, "approved")}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10" disabled={isSaving || status === "rejected" || !url} onClick={() => updateDocStatus(selected.id, field, "rejected", reason || "Documento no válido")}>
                            <XCircle className="mr-1 h-3 w-3" /> Rechazar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-medium">Motivo del rechazo (si aplica)</div>
                <Input placeholder="Ej: DNI ilegible, falta documento..." value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveAll(selected.id)} disabled={!!savingField}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar todos
                </Button>
                <Button variant="outline" onClick={() => setOpenId(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
