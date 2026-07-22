import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserPlus,
  Upload,
  FileSpreadsheet,
  Images,
  Download,
  Info,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  parsePlayersCsv,
  CSV_TEMPLATE,
  CSV_DOC_TYPES,
  normalizeKey,
  fileNameToKey,
  type ParsedPlayerRow,
} from "@/lib/playersCsv";
import { readZip } from "@/lib/zip";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];
const MAX_PHOTO_MB = 5;

interface TeamRow {
  id: string;
  name: string;
  category: string;
}

interface ExistingPlayer {
  id: string;
  full_name: string;
  id_document_number: string | null;
}

/**
 * Herramientas de administración para dar de alta jugadores: alta manual,
 * importación desde CSV y vinculación masiva de fotos desde un ZIP. Se muestra
 * en la vista "Fichas jugadores".
 */
export function PlayerImport({ onChanged }: { onChanged?: () => void } = {}) {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [existing, setExisting] = useState<ExistingPlayer[]>([]);

  const loadRefs = useCallback(async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("players").select("id, full_name, id_document_number"),
    ]);
    setTeams((t ?? []) as TeamRow[]);
    setExisting((p ?? []) as ExistingPlayer[]);
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const refresh = useCallback(async () => {
    await loadRefs();
    onChanged?.();
  }, [loadRefs, onChanged]);

  return (
    <Card className="border-dashed p-4">
      <Tabs defaultValue="manual">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Alta e importación de jugadores</h3>
            <p className="text-sm text-muted-foreground">
              Añade jugadores manualmente, impórtalos desde un CSV o vincula sus fotos desde un ZIP.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="manual">
              <UserPlus className="mr-1 h-4 w-4" /> Manual
            </TabsTrigger>
            <TabsTrigger value="csv">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> CSV
            </TabsTrigger>
            <TabsTrigger value="fotos">
              <Images className="mr-1 h-4 w-4" /> Fotos (ZIP)
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="mt-4">
          <ManualAdd teams={teams} onDone={refresh} />
        </TabsContent>
        <TabsContent value="csv" className="mt-4">
          <CsvImport teams={teams} existing={existing} onDone={refresh} />
        </TabsContent>
        <TabsContent value="fotos" className="mt-4">
          <PhotoZipImport onDone={refresh} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Alta manual
// ---------------------------------------------------------------------------

function ManualAdd({ teams, onDone }: { teams: TeamRow[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [teamId, setTeamId] = useState("");

  const reset = () => {
    setFullName("");
    setBirthDate("");
    setDocType("");
    setDocNumber("");
    setTeamId("");
  };

  const submit = async () => {
    const name = fullName.trim();
    if (!name) {
      toast.error("El nombre completo es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("players")
        .insert({
          full_name: name,
          birth_date: birthDate || null,
          id_document_type: docType || null,
          id_document_number: docNumber.trim() || null,
          team_id: teamId || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (teamId && data?.id) {
        // Registrar también en la tabla intermedia (equipo principal + player_teams).
        await supabase
          .from("player_teams")
          .insert({ player_id: data.id, team_id: teamId })
          .then(({ error: e }) => {
            if (e && e.code !== "23505") throw e; // ignora duplicado
          });
      }
      toast.success(`Jugador "${name}" añadido`);
      reset();
      setOpen(false);
      onDone();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`No se pudo crear el jugador: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Crea la ficha de un jugador con sus datos básicos. Después podrás subir su documentación y
        asignarle equipos.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Añadir jugador
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo jugador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre completo *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre y apellidos"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Equipo</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de documento</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CSV_DOC_TYPES.map((t) => (
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
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Ej: 12345678A"
                />
              </div>
            </div>
            <Button className="w-full" disabled={saving} onClick={submit}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                "Crear jugador"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Importación CSV
// ---------------------------------------------------------------------------

function CsvStructureHelp({ teams }: { teams: TeamRow[] }) {
  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_jugadores.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-primary">
        <Info className="h-4 w-4" /> Estructura del CSV
      </div>
      <p className="text-muted-foreground">
        La primera fila debe ser la cabecera. Separador admitido: coma (,) o punto y coma (;). Solo{" "}
        <span className="font-semibold text-foreground">nombre_completo</span> es obligatorio.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Columna</th>
              <th className="py-1 pr-3 font-medium">Obligatoria</th>
              <th className="py-1 font-medium">Descripción / ejemplo</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {[
              ["nombre_completo", "Sí", "Nombre y apellidos. Ej: Juan Pérez García"],
              ["fecha_nacimiento", "No", "AAAA-MM-DD o DD/MM/AAAA. Ej: 2012-05-14"],
              ["tipo_documento", "No", `Uno de: ${CSV_DOC_TYPES.join(", ")}`],
              ["numero_documento", "No", "Ej: 12345678A (sirve para vincular la foto)"],
              [
                "equipo",
                "No",
                "Nombre exacto de un equipo existente (vincula al jugador en player_teams). Ver valores posibles abajo.",
              ],
            ].map(([col, req, desc]) => (
              <tr key={col} className="border-t border-border/50">
                <td className="py-1 pr-3 font-mono text-foreground">{col}</td>
                <td className="py-1 pr-3">{req}</td>
                <td className="py-1 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-foreground">
          Valores posibles para la columna «equipo»
        </div>
        {teams.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay equipos creados todavía. Créalos en «Equipos» antes de asignarlos en el CSV.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Escribe en la columna <span className="font-mono">equipo</span> exactamente uno de
              estos nombres (se ignoran mayúsculas y acentos):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => (
                <Badge key={t.id} variant="outline" className="font-mono text-[11px]">
                  {t.name}
                  <span className="ml-1 text-muted-foreground">· {t.category}</span>
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>

      <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed">
        {CSV_TEMPLATE}
      </pre>
      <Button variant="outline" size="sm" onClick={downloadTemplate}>
        <Download className="mr-2 h-4 w-4" /> Descargar plantilla CSV
      </Button>
      <p className="text-xs text-muted-foreground">
        Tras importar los jugadores, ve a <span className="font-semibold text-foreground">Cuentas de
        familias</span> para generar en bloque los usuarios y contraseñas temporales de sus
        padres/tutores.
      </p>
    </div>
  );
}

function CsvImport({
  teams,
  existing,
  onDone,
}: {
  teams: TeamRow[];
  existing: ExistingPlayer[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState<ParsedPlayerRow[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Índices para detectar duplicados y resolver equipos por nombre.
  const existingByDoc = useMemo(() => {
    const m = new Map<string, ExistingPlayer>();
    existing.forEach((p) => {
      if (p.id_document_number) m.set(normalizeKey(p.id_document_number), p);
    });
    return m;
  }, [existing]);
  const existingByName = useMemo(() => {
    const m = new Map<string, ExistingPlayer>();
    existing.forEach((p) => m.set(normalizeKey(p.full_name), p));
    return m;
  }, [existing]);
  const teamByName = useMemo(() => {
    const m = new Map<string, TeamRow>();
    teams.forEach((t) => m.set(normalizeKey(t.name), t));
    return m;
  }, [teams]);

  const classify = (row: ParsedPlayerRow): "error" | "duplicate" | "ok" => {
    if (row.errors.length > 0) return "error";
    if (row.id_document_number && existingByDoc.has(normalizeKey(row.id_document_number)))
      return "duplicate";
    if (existingByName.has(normalizeKey(row.full_name))) return "duplicate";
    return "ok";
  };

  const summary = useMemo(() => {
    if (!rows) return { ok: 0, dup: 0, err: 0 };
    let ok = 0;
    let dup = 0;
    let err = 0;
    rows.forEach((r) => {
      const c = classify(r);
      if (c === "ok") ok++;
      else if (c === "duplicate") dup++;
      else err++;
    });
    return { ok, dup, err };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, existingByDoc, existingByName]);

  const onFile = async (file: File) => {
    setRows(null);
    setFatal(null);
    const text = await file.text();
    const res = parsePlayersCsv(text);
    if (res.fatal) {
      setFatal(res.fatal);
      return;
    }
    setRows(res.rows);
  };

  const runImport = async () => {
    if (!rows) return;
    const toInsert = rows.filter((r) => classify(r) === "ok");
    if (toInsert.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setImporting(true);
    let inserted = 0;
    let failed = 0;
    try {
      for (const row of toInsert) {
        const team = row.team ? teamByName.get(normalizeKey(row.team)) : undefined;
        const { data, error } = await supabase
          .from("players")
          .insert({
            full_name: row.full_name,
            birth_date: row.birth_date,
            id_document_type: row.id_document_type,
            id_document_number: row.id_document_number,
            team_id: team?.id ?? null,
          })
          .select("id")
          .single();
        if (error || !data) {
          failed++;
          continue;
        }
        inserted++;
        if (team) {
          const { error: ptErr } = await supabase
            .from("player_teams")
            .insert({ player_id: data.id, team_id: team.id });
          if (ptErr && ptErr.code !== "23505") {
            // No es crítico: el jugador ya está creado con su equipo principal.
          }
        }
      }
      if (inserted > 0) toast.success(`${inserted} jugador(es) importado(s)`);
      if (failed > 0) toast.error(`${failed} fila(s) fallaron al insertar`);
      setRows(null);
      onDone();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <CsvStructureHelp teams={teams} />

      <label
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted ${
          importing ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Upload className="h-4 w-4" /> Seleccionar CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {fatal && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {fatal}
        </div>
      )}

      {rows && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="border-green-500/30 bg-green-500/10 text-green-600" variant="outline">
              {summary.ok} nuevos
            </Badge>
            <Badge className="border-warning/30 bg-warning/10 text-warning" variant="outline">
              {summary.dup} duplicados (se omiten)
            </Badge>
            <Badge
              className="border-destructive/30 bg-destructive/10 text-destructive"
              variant="outline"
            >
              {summary.err} con errores
            </Badge>
          </div>

          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 font-medium">Nombre</th>
                  <th className="p-2 font-medium">Nacimiento</th>
                  <th className="p-2 font-medium">Documento</th>
                  <th className="p-2 font-medium">Equipo</th>
                  <th className="p-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const state = classify(r);
                  const teamMatch = r.team ? teamByName.get(normalizeKey(r.team)) : undefined;
                  return (
                    <tr key={r.line} className="border-t border-border/50">
                      <td className="p-2">
                        {r.full_name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">{r.birth_date ?? "—"}</td>
                      <td className="p-2">
                        {r.id_document_number
                          ? `${r.id_document_type ? r.id_document_type + " " : ""}${r.id_document_number}`
                          : "—"}
                      </td>
                      <td className="p-2">
                        {r.team ? (
                          teamMatch ? (
                            r.team
                          ) : (
                            <span className="text-warning">{r.team} (no existe)</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2">
                        {state === "ok" && <span className="text-green-600">Nuevo</span>}
                        {state === "duplicate" && <span className="text-warning">Duplicado</span>}
                        {state === "error" && (
                          <span className="text-destructive" title={r.errors.join("; ")}>
                            {r.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button disabled={importing || summary.ok === 0} onClick={runImport}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando…
              </>
            ) : (
              `Importar ${summary.ok} jugador(es)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Importación de fotos desde ZIP
// ---------------------------------------------------------------------------

interface PhotoResult {
  fileName: string;
  status: "ok" | "no-match" | "error";
  playerName?: string;
  detail?: string;
}

function PhotoZipImport({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PhotoResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const process = async (file: File) => {
    setBusy(true);
    setResults(null);
    setProgress(null);
    try {
      // Cargar jugadores para construir el índice de identificadores.
      const { data: players, error } = await supabase
        .from("players")
        .select("id, full_name, id_document_number");
      if (error) throw error;

      // Índice: número de documento → jugador; nombre completo → jugador.
      // El nombre del fichero de foto debe coincidir con uno de esos identificadores.
      const byKey = new Map<string, { id: string; full_name: string }>();
      (players ?? []).forEach((p) => {
        if (p.id_document_number) byKey.set(normalizeKey(p.id_document_number), p);
        byKey.set(normalizeKey(p.full_name), p);
        byKey.set(normalizeKey(p.id), p); // permite usar el UUID como nombre de fichero
      });

      const buffer = await file.arrayBuffer();
      const entries = readZip(buffer).filter((e) => {
        const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
        return IMAGE_EXT.includes(ext);
      });

      if (entries.length === 0) {
        toast.error("El ZIP no contiene imágenes (JPG, PNG o WebP)");
        setBusy(false);
        return;
      }

      const out: PhotoResult[] = [];
      let matched = 0;
      setProgress({ done: 0, total: entries.length });

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const key = fileNameToKey(entry.name);
        const player = byKey.get(key);
        try {
          if (!player) {
            out.push({ fileName: entry.name, status: "no-match" });
          } else {
            const bytes = await entry.bytes();
            if (bytes.byteLength > MAX_PHOTO_MB * 1024 * 1024) {
              out.push({
                fileName: entry.name,
                status: "error",
                playerName: player.full_name,
                detail: `Supera ${MAX_PHOTO_MB} MB`,
              });
            } else {
              const ext = entry.name.split(".").pop()?.toLowerCase() || "jpg";
              const mime =
                ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
              const path = `players/${player.id}/photo_${Date.now()}.${ext}`;
              const blob = new Blob([bytes as BlobPart], { type: mime });
              const { data: up, error: upErr } = await supabase.storage
                .from("player-docs")
                .upload(path, blob, { upsert: true, contentType: mime });
              if (upErr) throw upErr;
              const url = supabase.storage.from("player-docs").getPublicUrl(up.path).data.publicUrl;
              const { error: updErr } = await supabase
                .from("players")
                .update({ photo_url: url })
                .eq("id", player.id);
              if (updErr) throw updErr;
              matched++;
              out.push({ fileName: entry.name, status: "ok", playerName: player.full_name });
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          out.push({
            fileName: entry.name,
            status: "error",
            playerName: player?.full_name,
            detail: message,
          });
        }
        setProgress({ done: i + 1, total: entries.length });
      }

      setResults(out);
      if (matched > 0) {
        toast.success(`${matched} foto(s) vinculada(s)`);
        onDone();
      } else {
        toast.error("Ninguna foto coincidió con un jugador");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`No se pudo procesar el ZIP: ${message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const okCount = results?.filter((r) => r.status === "ok").length ?? 0;
  const noMatch = results?.filter((r) => r.status === "no-match").length ?? 0;
  const errCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-primary">
          <Info className="h-4 w-4" /> Cómo nombrar las fotos
        </div>
        <p className="text-muted-foreground">
          Sube un ZIP con las fotos. El nombre de cada archivo debe ser el{" "}
          <span className="font-semibold text-foreground">identificador del jugador</span>: su{" "}
          <span className="font-semibold text-foreground">número de documento</span> (recomendado) o
          su nombre completo. Formatos admitidos: JPG, PNG o WebP (máx. {MAX_PHOTO_MB} MB por foto).
        </p>
        <p className="text-muted-foreground">
          Ejemplos: <span className="font-mono text-foreground">12345678A.jpg</span> ·{" "}
          <span className="font-mono text-foreground">Juan Pérez García.png</span>. Se ignoran
          mayúsculas, acentos y las carpetas dentro del ZIP.
        </p>
      </div>

      <label
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Procesando…" : "Seleccionar ZIP de fotos"}
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) process(f);
            e.target.value = "";
          }}
        />
      </label>

      {progress && (
        <p className="text-xs text-muted-foreground">
          Procesando {progress.done} / {progress.total}…
        </p>
      )}

      {results && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="border-green-500/30 bg-green-500/10 text-green-600" variant="outline">
              {okCount} vinculadas
            </Badge>
            <Badge className="border-warning/30 bg-warning/10 text-warning" variant="outline">
              {noMatch} sin coincidencia
            </Badge>
            <Badge
              className="border-destructive/30 bg-destructive/10 text-destructive"
              variant="outline"
            >
              {errCount} con error
            </Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 font-medium">Archivo</th>
                  <th className="p-2 font-medium">Jugador</th>
                  <th className="p-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.fileName}-${i}`} className="border-t border-border/50">
                    <td className="p-2 font-mono">{r.fileName}</td>
                    <td className="p-2">{r.playerName ?? "—"}</td>
                    <td className="p-2">
                      {r.status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Vinculada
                        </span>
                      )}
                      {r.status === "no-match" && (
                        <span className="text-warning">Sin coincidencia</span>
                      )}
                      {r.status === "error" && (
                        <span className="text-destructive" title={r.detail}>
                          {r.detail ?? "Error"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
