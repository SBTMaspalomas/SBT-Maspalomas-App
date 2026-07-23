import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedPlayerDocs } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, FileText, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";

interface RegistrationRow {
  id: string;
  type: string;
  full_name: string | null;
  federativa_pdf_url: string | null;
  federativa_status: string | null;
}

// Ficha federativa cumplimentada que el administrador sube por jugador a la tabla
// `players` (bucket player-docs). La familia/senior la descarga desde aquí.
interface PlayerFichaRow {
  id: string;
  full_name: string;
  federativa_pdf_url: string | null;
}

const STATUS_UI: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: {
    label: "En revisión",
    cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    icon: Clock,
  },
  approved: {
    label: "Aprobada",
    cls: "bg-green-500/10 text-green-500 border-green-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rechazada",
    cls: "bg-red-500/10 text-red-500 border-red-500/30",
    icon: XCircle,
  },
};

export function FederativaDoc() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [fichas, setFichas] = useState<PlayerFichaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Registros del usuario (para la subida de la ficha firmada) y fichas de sus
    // jugadores (para la descarga del PDF que sube el admin). RLS limita los
    // `players` visibles a los hijos de la familia y al propio jugador senior.
    const [{ data, error }, { data: playersData, error: playersErr }] = await Promise.all([
      supabase
        .from("registrations")
        .select("id, type, full_name, federativa_pdf_url, federativa_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase.from("players").select("id, full_name, federativa_pdf_url").order("full_name"),
    ]);
    if (error) {
      toast.error("No se pudieron cargar tus registros");
      setLoading(false);
      return;
    }
    if (playersErr) {
      toast.error("No se pudieron cargar las fichas de tus jugadores");
    }
    setRegistrations((data ?? []) as RegistrationRow[]);
    setFichas((playersData ?? []) as PlayerFichaRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // URLs firmadas de corta duración para descargar las fichas (bucket privado).
  const signedDocs = useSignedPlayerDocs([
    ...fichas.map((f) => f.federativa_pdf_url),
    ...registrations.map((r) => r.federativa_pdf_url),
  ]);

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
          <CardTitle className="text-base">Descarga tu ficha federativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            El club prepara y sube la ficha federativa de cada jugador. Descárgala, fírmala tras el
            reconocimiento médico y súbela firmada más abajo.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : fichas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay jugadores a tu nombre todavía.</p>
          ) : (
            <div className="space-y-2">
              {fichas.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{f.full_name}</span>
                  </div>
                  {f.federativa_pdf_url && signedDocs.get(f.federativa_pdf_url) ? (
                    <a
                      href={signedDocs.get(f.federativa_pdf_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Descargar ficha
                      </Button>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {f.federativa_pdf_url ? "Preparando…" : "Aún no disponible"}
                    </span>
                  )}
                </div>
              ))}
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
                    {reg.federativa_pdf_url && signedDocs.get(reg.federativa_pdf_url) && (
                      <a
                        href={signedDocs.get(reg.federativa_pdf_url)}
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
                      {isUploading
                        ? "Subiendo…"
                        : reg.federativa_pdf_url
                          ? "Resubir PDF"
                          : "Subir PDF firmado"}
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
