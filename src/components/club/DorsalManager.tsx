import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Hash } from "lucide-react";

interface TeamRow { id: string; name: string; category: string }
interface PlayerRow { id: string; full_name: string; team_id: string | null }

const keyOf = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export function DorsalManager() {
  const { user, role } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // dorsal asignado en BD por jugador (para el equipo seleccionado)
  const [dorsals, setDorsals] = useState<Record<string, number | null>>({});
  // valor en edición del input por jugador
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const [coachTeamsResult, teamsResult, playersResult] = await Promise.all([
        role === "admin"
          ? Promise.resolve({ data: [], error: null })
          : supabase.from("coach_teams").select("team_id").eq("user_id", user.id),
        supabase.from("teams").select("id, name, category").order("name"),
        supabase.from("players").select("id, full_name, team_id").order("full_name"),
      ]);
      if (!active) return;
      if (coachTeamsResult.error || teamsResult.error || playersResult.error) {
        setTeams([]); setPlayers([]); setTeamId("");
        setLoadError("No se pudieron cargar los equipos.");
        setLoading(false);
        return;
      }
      const allTeams = (teamsResult.data ?? []) as TeamRow[];
      const assignedKeys = new Set(
        (coachTeamsResult.data ?? []).map((r) => keyOf(String(r.team_id ?? ""))).filter(Boolean),
      );
      const ts = role === "admin"
        ? allTeams
        : allTeams.filter((t) =>
            assignedKeys.has(keyOf(t.id)) || assignedKeys.has(keyOf(t.name)) || assignedKeys.has(keyOf(t.category)));
      setTeams(ts);
      setPlayers((playersResult.data ?? []) as PlayerRow[]);
      setTeamId((prev) => prev && ts.find((t) => t.id === prev) ? prev : (ts[0]?.id ?? ""));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user, role]);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === teamId) ?? null, [teams, teamId]);

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const teamKeys = new Set([keyOf(selectedTeam.id), keyOf(selectedTeam.name), keyOf(selectedTeam.category)]);
    return players.filter((p) => p.team_id ? teamKeys.has(keyOf(p.team_id)) : false);
  }, [players, selectedTeam]);

  // Cargar los dorsales ya asignados para el equipo seleccionado.
  const loadDorsals = useCallback(async () => {
    if (!teamId) { setDorsals({}); setDrafts({}); return; }
    const { data, error } = await supabase
      .from("player_teams")
      .select("player_id, dorsal")
      .eq("team_id", teamId);
    if (error) { setDorsals({}); setDrafts({}); return; }
    const map: Record<string, number | null> = {};
    (data ?? []).forEach((r) => { map[r.player_id] = r.dorsal; });
    setDorsals(map);
    setDrafts(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v == null ? "" : String(v)])));
  }, [teamId]);

  useEffect(() => { loadDorsals(); }, [loadDorsals]);

  const saveDorsal = async (playerId: string) => {
    if (!teamId) return;
    const raw = (drafts[playerId] ?? "").trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 999)) {
      toast.error("El dorsal debe ser un número entre 0 y 999");
      return;
    }
    setSavingId(playerId);
    const { error } = await supabase.rpc("set_player_dorsal", {
      _player_id: playerId,
      _team_id: teamId,
      _dorsal: value as number,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message || "No se pudo guardar el dorsal");
      return;
    }
    toast.success(value === null ? "Dorsal eliminado" : `Dorsal ${value} asignado`);
    loadDorsals();
  };

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent></Card>;
  }
  if (loadError) {
    return <Card><CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent></Card>;
  }
  if (teams.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No tienes equipos asignados.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Dorsales</CardTitle>
              <p className="text-sm text-muted-foreground">El dorsal es único dentro de cada equipo.</p>
            </div>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecciona equipo" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {teamPlayers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay jugadores en este equipo.
            </div>
          ) : (
            teamPlayers.map((player) => {
              const current = dorsals[player.id];
              const draft = drafts[player.id] ?? "";
              const changed = draft !== (current == null ? "" : String(current));
              return (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{player.full_name}</div>
                    {current != null && (
                      <div className="text-xs text-muted-foreground">Dorsal actual: {current}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        inputMode="numeric"
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [player.id]: e.target.value }))}
                        className="w-24 pl-8"
                        placeholder="—"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!changed || savingId === player.id}
                      onClick={() => saveDorsal(player.id)}
                    >
                      {savingId === player.id ? "…" : "Guardar"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
