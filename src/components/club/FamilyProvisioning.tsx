import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users2,
  KeyRound,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  Info,
  CheckCircle2,
} from "lucide-react";

interface TeamRow {
  id: string;
  name: string;
  category: string;
}
interface PlayerRow {
  id: string;
  full_name: string;
  team_id: string | null;
  family_id: string | null;
}
interface FamilyRow {
  id: string;
  head_profile_id: string | null;
}
interface CredentialRow {
  id: string;
  username: string;
  temp_password: string | null;
  child_name: string | null;
  used: boolean;
  created_at: string;
}
interface CreatedResult {
  playerId?: string;
  childName?: string;
  username: string;
  tempPassword: string;
}

async function copy(text: string, label = "Copiado") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("No se pudo copiar");
  }
}

/**
 * Provisión de cuentas de familias (padres/tutores) por el admin. Tras importar
 * los jugadores por CSV, el admin elige un equipo, selecciona los jugadores sin
 * cuenta y genera de golpe usuario + contraseña temporal para cada tutor. Las
 * credenciales quedan guardadas y se pueden copiar o exportar a CSV.
 */
export function FamilyProvisioning() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [playerTeams, setPlayerTeams] = useState<{ player_id: string; team_id: string }[]>([]);
  const [creds, setCreds] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamId, setTeamId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreatedResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: t },
      { data: p },
      { data: f },
      { data: pt },
      { data: c },
    ] = await Promise.all([
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("players").select("id, full_name, team_id, family_id"),
      supabase.from("families_meta").select("id, head_profile_id"),
      supabase.from("player_teams").select("player_id, team_id"),
      supabase
        .from("provisioned_credentials")
        .select("id, username, temp_password, child_name, used, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setTeams((t ?? []) as TeamRow[]);
    setPlayers((p ?? []) as PlayerRow[]);
    setFamilies((f ?? []) as FamilyRow[]);
    setPlayerTeams((pt ?? []) as { player_id: string; team_id: string }[]);
    setCreds((c ?? []) as CredentialRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Familias que ya tienen un adulto responsable con cuenta.
  const familyHasHead = useMemo(() => {
    const m = new Map<string, boolean>();
    families.forEach((f) => m.set(f.id, !!f.head_profile_id));
    return m;
  }, [families]);

  // Jugadores del equipo elegido que aún NO tienen cuenta de tutor: su familia no
  // existe o no tiene adulto responsable vinculado.
  const eligible = useMemo(() => {
    if (!teamId) return [];
    const inTeam = new Set<string>();
    players.forEach((p) => {
      if (p.team_id === teamId) inTeam.add(p.id);
    });
    playerTeams.forEach((pt) => {
      if (pt.team_id === teamId) inTeam.add(pt.player_id);
    });
    return players
      .filter((p) => inTeam.has(p.id))
      .filter((p) => !(p.family_id && familyHasHead.get(p.family_id)))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [teamId, players, playerTeams, familyHasHead]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = eligible.length > 0 && eligible.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (eligible.every((p) => prev.has(p.id))) return new Set();
      return new Set(eligible.map((p) => p.id));
    });
  };

  // Al cambiar de equipo, limpiar la selección.
  useEffect(() => {
    setSelected(new Set());
  }, [teamId]);

  const generate = async () => {
    const chosen = eligible.filter((p) => selected.has(p.id));
    if (chosen.length === 0) {
      toast.error("Selecciona al menos un jugador");
      return;
    }
    setGenerating(true);
    setLastCreated([]);
    try {
      const { data, error } = await supabase.functions.invoke<{
        created: CreatedResult[];
        failed: { childName?: string; error: string }[];
      }>("admin-provision-parents", {
        body: {
          parents: chosen.map((p) => ({
            playerId: p.id,
            childName: p.full_name,
            // Reutiliza la familia existente si el jugador ya está vinculado a una
            // (sin adulto responsable), en vez de crear una nueva.
            familyId: p.family_id ?? undefined,
          })),
        },
      });
      if (error) throw error;
      const created = data?.created ?? [];
      const failed = data?.failed ?? [];
      setLastCreated(created);
      if (created.length > 0) toast.success(`${created.length} cuenta(s) creada(s)`);
      if (failed.length > 0) toast.error(`${failed.length} fallaron`);
      setSelected(new Set());
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudieron crear las cuentas: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const pending = creds.filter((c) => c.temp_password);

  const exportCsv = () => {
    if (pending.length === 0) {
      toast.error("No hay credenciales pendientes que exportar");
      return;
    }
    const header = "jugador,usuario,contrasena_temporal\n";
    const body = pending
      .map((c) => {
        const child = (c.child_name ?? "").replace(/"/g, '""');
        return `"${child}",${c.username},${c.temp_password}`;
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credenciales_familias.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    if (pending.length === 0) return;
    const text = pending
      .map((c) => `${c.child_name ?? ""} · usuario: ${c.username} · contraseña: ${c.temp_password}`)
      .join("\n");
    copy(text, `${pending.length} credenciales copiadas`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Cuentas de familias</h2>
        <p className="text-sm text-muted-foreground">
          Genera usuarios y contraseñas temporales para los padres/tutores. Entrégaselas para que
          entren, cambien la contraseña y completen su registro familiar.
        </p>
      </div>

      {/* Generación por equipo */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Equipo</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecciona un equipo…" />
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
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>

        {teamId && (
          <div className="space-y-3">
            {eligible.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Ningún jugador de este equipo está pendiente de cuenta (todos tienen ya un tutor con
                acceso).
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    Seleccionar todos ({eligible.length})
                  </label>
                  <Button onClick={generate} disabled={generating || selected.size === 0}>
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando…
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" /> Generar {selected.size || ""} cuenta(s)
                      </>
                    )}
                  </Button>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {eligible.map((p) => (
                        <tr key={p.id} className="border-t border-border/50 first:border-t-0">
                          <td className="w-10 p-2">
                            <Checkbox
                              checked={selected.has(p.id)}
                              onCheckedChange={() => toggle(p.id)}
                            />
                          </td>
                          <td className="p-2">{p.full_name}</td>
                          <td className="p-2 text-right">
                            {p.family_id ? (
                              <Badge variant="outline" className="text-[11px]">
                                Familia sin acceso
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px]">
                                Sin familia
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Resultado inmediato de la última generación (con contraseñas visibles) */}
        {lastCreated.length > 0 && (
          <div className="space-y-2 rounded-md border border-green-500/30 bg-green-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> {lastCreated.length} cuenta(s) creada(s)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Jugador</th>
                    <th className="py-1 pr-3 font-medium">Usuario</th>
                    <th className="py-1 pr-3 font-medium">Contraseña temporal</th>
                    <th className="py-1 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {lastCreated.map((c) => (
                    <tr key={c.username} className="border-t border-border/50">
                      <td className="py-1 pr-3">{c.childName ?? "—"}</td>
                      <td className="py-1 pr-3 font-mono">{c.username}</td>
                      <td className="py-1 pr-3 font-mono">{c.tempPassword}</td>
                      <td className="py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copy(`usuario: ${c.username}\ncontraseña: ${c.tempPassword}`)
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Credenciales pendientes de entrega */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Credenciales pendientes de entrega</h3>
            <Badge variant="outline" className="text-[11px]">
              {pending.length}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyAll} disabled={pending.length === 0}>
              <Copy className="mr-2 h-4 w-4" /> Copiar todo
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={pending.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          La contraseña temporal desaparece automáticamente en cuanto el tutor la cambia en su
          primer acceso. Entrégalas cuanto antes y no las conserves fuera de aquí.
        </p>

        {creds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no has generado ninguna cuenta.</p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 font-medium">Jugador</th>
                  <th className="p-2 font-medium">Usuario</th>
                  <th className="p-2 font-medium">Contraseña temporal</th>
                  <th className="p-2 font-medium">Estado</th>
                  <th className="p-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {creds.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-border/50 ${c.used ? "opacity-50" : ""}`}
                  >
                    <td className="p-2">{c.child_name ?? "—"}</td>
                    <td className="p-2 font-mono">{c.username}</td>
                    <td className="p-2 font-mono">{c.temp_password ?? "••••••"}</td>
                    <td className="p-2">
                      {c.used ? (
                        <span className="text-muted-foreground">Usada</span>
                      ) : (
                        <span className="text-warning">Pendiente</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {c.temp_password && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copy(`usuario: ${c.username}\ncontraseña: ${c.temp_password}`)
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
