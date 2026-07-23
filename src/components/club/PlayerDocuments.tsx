import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedPlayerDoc } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PlayerImport } from "@/components/club/PlayerImport";
import {
  IdCard,
  FileText,
  Camera,
  Upload,
  Download,
  RefreshCw,
  Edit2,
  CheckCircle2,
  Save,
} from "lucide-react";

// Tipos de documento admitidos (deben coincidir con el CHECK de la migración).
const DOC_TYPES = ["DNI", "NIE", "Pasaporte", "DNI tutor"] as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type DocKind = "federativa" | "photo" | "dni";

interface PlayerRow {
  id: string;
  full_name: string;
  family_id: string | null;
  user_id: string | null;
  birth_date: string | null;
  federativa_pdf_url: string | null;
  photo_url: string | null;
  id_document_url: string | null;
  id_document_type: string | null;
  id_document_number: string | null;
}

export function PlayerDocuments() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [refCodes, setRefCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [docType, setDocType] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p, error }, { data: fams }] = await Promise.all([
      supabase
        .from("players")
        .select(
          "id, full_name, family_id, user_id, birth_date, federativa_pdf_url, photo_url, id_document_url, id_document_type, id_document_number",
        )
        .order("full_name"),
      supabase.from("families_meta").select("id, reference_code"),
    ]);
    if (error) {
      toast.error("No se pudieron cargar los jugadores");
      setLoading(false);
      return;
    }
    setPlayers((p ?? []) as PlayerRow[]);
    const codes: Record<string, string> = {};
    (fams ?? []).forEach((f: { id: string; reference_code: string | null }) => {
      if (f.reference_code) codes[f.id] = f.reference_code;
    });
    setRefCodes(codes);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const identifierFor = (player: PlayerRow): string => {
    if (player.family_id && refCodes[player.family_id]) return refCodes[player.family_id];
    if (player.user_id) return "Senior";
    return "—";
  };

  const editing = useMemo(() => players.find((p) => p.id === openId) ?? null, [players, openId]);

  const openDialog = (player: PlayerRow) => {
    setOpenId(player.id);
    setDocType(player.id_document_type ?? "");
    setDocNumber(player.id_document_number ?? "");
  };

  const handleUpload = async (player: PlayerRow, kind: DocKind, file: File) => {
    // Validación de tipo por documento.
    if (kind === "federativa") {
      if (file.type !== "application/pdf") {
        toast.error("La ficha federativa debe ser un PDF");
        return;
      }
    } else if (kind === "photo") {
      if (!IMAGE_TYPES.includes(file.type)) {
        toast.error("La foto debe ser JPG, PNG o WebP");
        return;
      }
    } else {
      // DNI: se admite imagen o PDF.
      if (!IMAGE_TYPES.includes(file.type) && file.type !== "application/pdf") {
        toast.error("El documento debe ser una imagen (JPG/PNG/WebP) o un PDF");
        return;
      }
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`El archivo excede ${MAX_SIZE_MB} MB`);
      return;
    }

    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg");
      // El admin sube a `players/${playerId}/...` (política player_docs_admin_all).
      const path = `players/${player.id}/${kind}_${Date.now()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from("player-docs")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("player-docs").getPublicUrl(up.path).data.publicUrl;

      const patch =
        kind === "federativa"
          ? { federativa_pdf_url: url }
          : kind === "photo"
            ? { photo_url: url }
            : { id_document_url: url };
      const { error: updErr } = await supabase.from("players").update(patch).eq("id", player.id);
      if (updErr) throw updErr;

      toast.success(
        kind === "federativa"
          ? "Ficha federativa subida"
          : kind === "photo"
            ? "Foto subida"
            : "Documento subido",
      );
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al subir: ${message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleSaveMeta = async (player: PlayerRow) => {
    setSavingMeta(true);
    try {
      const { error } = await supabase
        .from("players")
        .update({
          id_document_type: docType ? docType : null,
          id_document_number: docNumber.trim() ? docNumber.trim() : null,
        })
        .eq("id", player.id);
      if (error) throw error;
      toast.success("Datos de documento guardados");
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al guardar: ${message}`);
    } finally {
      setSavingMeta(false);
    }
  };

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" />
            Fichas y documentación
          </h2>
          <p className="text-sm text-muted-foreground">
            Sube la ficha federativa, la foto y el documento de identidad de cada jugador.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <PlayerImport onChanged={load} />

      <Input
        placeholder="Buscar jugador por nombre…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando jugadores…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {players.length === 0
              ? "No hay jugadores registrados"
              : "Sin resultados para la búsqueda"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => (
            <Card key={player.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{player.full_name}</h3>
                    <Badge variant="outline" className="font-mono text-xs">
                      {identifierFor(player)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <DocChip label="Ficha federativa" ok={!!player.federativa_pdf_url} />
                    <DocChip label="Foto" ok={!!player.photo_url} />
                    <DocChip label="Documento" ok={!!player.id_document_url} />
                    {player.id_document_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {player.id_document_type}
                        {player.id_document_number ? ` · ${player.id_document_number}` : ""}
                      </Badge>
                    )}
                  </div>
                </div>

                <Dialog
                  open={openId === player.id}
                  onOpenChange={(o) => (o ? openDialog(player) : setOpenId(null))}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => openDialog(player)}>
                      <Edit2 className="mr-1 h-4 w-4" />
                      Gestionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Documentación de {player.full_name}</DialogTitle>
                    </DialogHeader>

                    {editing && editing.id === player.id && (
                      <div className="space-y-5">
                        {/* Tipo y número de documento */}
                        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Tipo de documento</Label>
                              <Select value={docType} onValueChange={setDocType}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOC_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Número de documento</Label>
                              <Input
                                placeholder="Ej: 12345678A"
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={savingMeta}
                            onClick={() => handleSaveMeta(editing)}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {savingMeta ? "Guardando…" : "Guardar datos"}
                          </Button>
                        </div>

                        {/* Subidas de archivos */}
                        <DocUploader
                          icon={FileText}
                          title="Ficha federativa (PDF)"
                          description="PDF que el jugador podrá descargar desde su zona."
                          currentUrl={editing.federativa_pdf_url}
                          accept="application/pdf"
                          busy={uploading === "federativa"}
                          onSelect={(f) => handleUpload(editing, "federativa", f)}
                        />
                        <DocUploader
                          icon={Camera}
                          title="Foto"
                          description="Imagen JPG, PNG o WebP (máx. 5 MB)."
                          currentUrl={editing.photo_url}
                          accept="image/jpeg,image/png,image/webp"
                          busy={uploading === "photo"}
                          onSelect={(f) => handleUpload(editing, "photo", f)}
                          preview
                        />
                        <DocUploader
                          icon={IdCard}
                          title="Documento de identidad"
                          description="Imagen o PDF del DNI/NIE/Pasaporte (máx. 5 MB)."
                          currentUrl={editing.id_document_url}
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          busy={uploading === "dni"}
                          onSelect={(f) => handleUpload(editing, "dni", f)}
                        />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DocChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-600"
          : "border-border text-muted-foreground"
      }`}
    >
      {ok && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
}

function DocUploader({
  icon: Icon,
  title,
  description,
  currentUrl,
  accept,
  busy,
  onSelect,
  preview = false,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  currentUrl: string | null;
  accept: string;
  busy: boolean;
  onSelect: (file: File) => void;
  preview?: boolean;
}) {
  // El bucket es privado: firma la URL guardada para poder mostrar/descargar.
  const signedUrl = useSignedPlayerDoc(currentUrl);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      {currentUrl && signedUrl && (
        <div className="flex items-center gap-3">
          {preview && (
            <img
              src={signedUrl}
              alt={title}
              className="h-14 w-14 rounded-md border border-border object-cover"
            />
          )}
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="h-3 w-3" /> Ver archivo actual
          </a>
        </div>
      )}

      <label
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Upload className="h-4 w-4" />
        {busy ? "Subiendo…" : currentUrl ? "Reemplazar" : "Subir"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
