import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, FileText, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";

// URL de la plantilla oficial en blanco de la Ficha Federativa Única.
// PLACEHOLDER CONFIGURABLE: cuando el club publique el PDF oficial (en Storage o
// en public/), poner aquí su URL y el botón «Descargar plantilla» se habilitará.
const FEDERATIVA_TEMPLATE_URL = "";

interface RegistrationRow {
  id: string;
  type: string;
  full_name: string | null;
  federativa_pdf_url: string | null;
  federativa_status: string | null;
}

const STATUS_UI: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "En revisión", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", icon: Clock },
  approved: { label: "Aprobada", cls: "bg-green-500/10 text-green-500 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-500 border-red-500/30", icon: XCircle },
};

export function FederativaDoc() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations")
      .select("id, type, full_name, federativa_pdf_url, federativa_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("No se pudieron cargar tus registros");
      setLoading(false);
      return;
    }
    setRegistrations((data ?? []) as RegistrationRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (regId: string, file: File) => {
    if (!user) return;
    if (file.type !== "application/pdf") {
      toast.error("La ficha federativa debe ser un PDF");
      return;
    }
    setUploadingId(regId);
    try {
      const path = `${user.id}/federativa_${regId}_${Date.now()}.pdf`;
      const { data: up, error: upErr } = await supabase.storage
        .from("player-docs")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("player-docs").getPublicUrl(up.path).data.publicUrl;

      const { error: updErr } = await supabase
        .from("registrations")
        .update({ federativa_pdf_url: url, federativa_status: "pending" })
        .eq("id", regId);
      if (updErr) throw updErr;

      toast.success("Ficha federativa subida. Pendiente de validación.");
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al subir la ficha: ${message}`);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Ficha Federativa</h2>
          <p className="text-sm text-muted-foreground">
            Descarga la ficha, fírmala tras el reconocimiento médico y súbela firmada en PDF.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documento oficial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FEDERATIVA_TEMPLATE_URL ? (
            <a href={FEDERATIVA_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Descargar plantilla oficial
              </Button>
            </a>
          ) : (
            <div className="space-y-2">
              <Button variant="outline" className="w-full sm:w-auto" disabled>
                <Download className="mr-2 h-4 w-4" /> Descargar plantilla oficial
              </Button>
              <p className="text-xs text-muted-foreground">
                La plantilla oficial aún no está publicada. Podrás descargarla aquí en cuanto el club la habilite.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </Card>
      ) : registrations.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No hay registros a tu nombre todavía.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {registrations.map((reg) => {
            const status = reg.federativa_status ?? (reg.federativa_pdf_url ? "pending" : null);
            const S = status ? STATUS_UI[status] : null;
            const isUploading = uploadingId === reg.id;
            return (
              <Card key={reg.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{reg.full_name || "—"}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {reg.type === "adult" ? "Adulto" : "Menor"}
                      </Badge>
                    </div>
                    {reg.federativa_pdf_url && (
                      <a
                        href={reg.federativa_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Ver PDF subido
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {S && (
                      <Badge variant="outline" className={`text-xs ${S.cls}`}>
                        <S.icon className="mr-1 h-3 w-3" /> {S.label}
                      </Badge>
                    )}
                    <label
                      className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Subiendo…" : reg.federativa_pdf_url ? "Resubir PDF" : "Subir PDF firmado"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(reg.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
