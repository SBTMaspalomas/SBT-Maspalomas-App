import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AttendanceStatus = "present" | "late" | "absent";
type AbsenceReason = "justified" | "unjustified";
interface DayEntry {
  status?: AttendanceStatus;
  absentReason?: AbsenceReason;
}
type AttendanceMap = Record<string, Record<string, DayEntry>>; // playerId -> date -> entry

interface TeamRow { id: string; name: string; category: string }
interface PlayerRow { id: string; full_name: string; team_id: string | null }

const STORAGE_KEY = "attendance_v2";

const keyOf = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

function loadAttendance(): AttendanceMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as AttendanceMap; }
  catch { return {}; }
}
function saveAttendance(m: AttendanceMap) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export function Attendance() {
  const { user, role } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceMap>(() => loadAttendance());

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

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
        setTeams([]);
        setPlayers([]);
        setTeamId("");
        setLoadError("No se pudieron cargar las asignaciones de asistencia.");
        setLoading(false);
        return;
      }

      const allTeams = (teamsResult.data ?? []) as TeamRow[];
      const assignedTeamKeys = new Set(
        (coachTeamsResult.data ?? [])
          .map((r) => keyOf(String(r.team_id ?? "")))
          .filter(Boolean),
      );
      const ts = role === "admin"
        ? allTeams
        : allTeams.filter((team) =>
            assignedTeamKeys.has(keyOf(team.id))
            || assignedTeamKeys.has(keyOf(team.name))
            || assignedTeamKeys.has(keyOf(team.category)),
          );

      setTeams(ts);
      setPlayers((playersResult.data ?? []) as PlayerRow[]);
      setTeamId((prev) => prev && ts.find((t) => t.id === prev) ? prev : (ts[0]?.id ?? ""));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user, role]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teams, teamId],
  );

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const teamKeys = new Set([keyOf(selectedTeam.id), keyOf(selectedTeam.name), keyOf(selectedTeam.category)]);
    return players.filter((p) => p.team_id ? teamKeys.has(keyOf(p.team_id)) : false);
  }, [players, selectedTeam]);

  const updateEntry = (playerId: string, patch: Partial<DayEntry>) => {
    setAttendance((prev) => {
      const forPlayer = { ...(prev[playerId] ?? {}) };
      forPlayer[date] = { ...(forPlayer[date] ?? {}), ...patch };
      const next = { ...prev, [playerId]: forPlayer };
      saveAttendance(next);
      return next;
    });
  };

  const setStatus = (playerId: string, status: AttendanceStatus) => {
    updateEntry(playerId, {
      status,
      absentReason: status === "absent"
        ? (attendance[playerId]?.[date]?.absentReason ?? "unjustified")
        : undefined,
    });
  };
  const setReason = (playerId: string, reason: AbsenceReason) =>
    updateEntry(playerId, { status: "absent", absentReason: reason });

  const monthlyLateStats = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return teamPlayers.map((p) => {
      const entries = Object.entries(attendance[p.id] ?? {}).filter(([d]) => d.startsWith(monthPrefix));
      const lateCount = entries.filter(([, v]) => v?.status === "late").length;
      const presentCount = entries.filter(([, v]) => v?.status === "present").length;
      const absentCount = entries.filter(([, v]) => v?.status === "absent").length;
      return { id: p.id, name: p.full_name, lateCount, presentCount, absentCount };
    }).sort((a, b) => b.lateCount - a.lateCount || a.name.localeCompare(b.name));
  }, [teamPlayers, attendance]);

  if (loading) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent></Card>
    );
  }

  if (loadError) {
    return (
      <Card><CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent></Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No tienes equipos asignados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">Asistencia</CardTitle>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecciona equipo" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha seleccionada
              </p>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {date !== today && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Editando una fecha anterior
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {teamPlayers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No hay jugadores en este equipo.
              </div>
            ) : (
              teamPlayers.map((player) => {
                const day = attendance[player.id]?.[date] ?? {};
                const status = day.status ?? null;
                const absentReason = day.absentReason ?? "unjustified";
                return (
                  <div key={player.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-foreground">{player.full_name}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setStatus(player.id, "present")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "present"
                            ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                        ].join(" ")}
                      >Presente</button>
                      <button
                        type="button"
                        onClick={() => setStatus(player.id, "late")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "late"
                            ? "border-amber-700 bg-amber-500 text-white shadow-sm"
                            : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                        ].join(" ")}
                      ><span className="mr-2 text-base">⏱️</span>Retraso</button>
                      <button
                        type="button"
                        onClick={() => setStatus(player.id, "absent")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "absent"
                            ? "border-red-700 bg-red-600 text-white shadow-sm"
                            : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                        ].join(" ")}
                      >Ausente</button>
                    </div>

                    {status === "absent" && (
                      <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Motivo de la falta
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setReason(player.id, "justified")}
                            className={[
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              absentReason === "justified"
                                ? "border-sky-700 bg-sky-600 text-white"
                                : "border-border bg-background text-foreground hover:bg-muted",
                            ].join(" ")}
                          >Justificada</button>
                          <button
                            type="button"
                            onClick={() => setReason(player.id, "unjustified")}
                            className={[
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              absentReason === "unjustified"
                                ? "border-slate-800 bg-slate-700 text-white"
                                : "border-border bg-background text-foreground hover:bg-muted",
                            ].join(" ")}
                          >Injustificada</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {monthlyLateStats.length > 0 && (
            <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Retrasos del mes</h3>
              <ul className="space-y-1 text-sm">
                {monthlyLateStats.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.lateCount} retrasos · {s.presentCount} presentes · {s.absentCount} ausentes
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
