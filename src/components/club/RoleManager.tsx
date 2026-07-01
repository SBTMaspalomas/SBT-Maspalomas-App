import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Search, RefreshCw } from "lucide-react";

type Role = "admin" | "coach" | "parent" | "player";

interface TeamRow { id: string; name: string; category: string; }
interface PlayerRow { id: string; first_name: string; last_name: string; team_id: string | null; user_id: string | null; }

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  teamIds: string[]; // coach
  linkedPlayerIds: string[]; // parent (tutor_players)
  ownPlayerId: string | null; // player (players.user_id)
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coach: "Entrenador",
  parent: "Padre / Tutor",
  player: "Jugador/a",
};

export function RoleManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: profiles, error: pErr },
      { data: roles, error: rErr },
      { data: ct, error: ctErr },
      { data: tp, error: tpErr },
      { data: teamsData, error: tErr },
      { data: playersData, error: plErr },
    ] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("coach_teams").select("user_id, team_id"),
      supabase.from("tutor_players").select("tutor_user_id, player_id"),
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("players").select("id, first_name, last_name, team_id, user_id").order("last_name"),
    ]);
    if (pErr || rErr || ctErr || tpErr || tErr || plErr) {
      toast.error("No se pudieron cargar los datos");
      setLoading(false);
      return;
    }
    setTeams(teamsData ?? []);
    setPlayers(playersData ?? []);

    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    const teamMap = new Map<string, string[]>();
    (ct ?? []).forEach((r) => {
      const arr = teamMap.get(r.user_id) ?? []; arr.push(r.team_id); teamMap.set(r.user_id, arr);
    });
    const tutorMap = new Map<string, string[]>();
    (tp ?? []).forEach((r) => {
      const arr = tutorMap.get(r.tutor_user_id) ?? []; arr.push(r.player_id); tutorMap.set(r.tutor_user_id, arr);
    });
    const ownPlayerMap = new Map<string, string>();
    (playersData ?? []).forEach((p) => { if (p.user_id) ownPlayerMap.set(p.user_id, p.id); });

    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleMap.get(p.id) ?? "parent",
        teamIds: teamMap.get(p.id) ?? [],
        linkedPlayerIds: tutorMap.get(p.id) ?? [],
        ownPlayerId: ownPlayerMap.get(p.id) ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, newRole: Role) => {
    setSavingId(userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error("Error al asignar rol"); setSavingId(null); return; }
    if (newRole !== "coach") await supabase.from("coach_teams").delete().eq("user_id", userId);
    if (newRole !== "parent") await supabase.from("tutor_players").delete().eq("tutor_user_id", userId);
    if (newRole !== "player") await supabase.from("players").update({ user_id: null }).eq("user_id", userId);
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}`);
    setSavingId(null);
    load();
  };

  const toggleTeam = async (userId: string, teamId: string, assigned: boolean) => {
    setSavingId(userId);
    if (assigned) await supabase.from("coach_teams").delete().eq("user_id", userId).eq("team_id", teamId);
    else await supabase.from("coach_teams").insert({ user_id: userId, team_id: teamId });
    setSavingId(null); load();
  };

  const toggleLinkedPlayer = async (userId: string, playerId: string, linked: boolean) => {
    setSavingId(userId);
    if (linked) await supabase.from("tutor_players").delete().eq("tutor_user_id", userId).eq("player_id", playerId);
    else await supabase.from("tutor_players").insert({ tutor_user_id: userId, player_id: playerId });
    setSavingId(null); load();
  };

  const linkOwnPlayer = async (userId: string, playerId: string) => {
    setSavingId(userId);
    // Detach anyone else previously bound + detach this user from other players
    await supabase.from("players").update({ user_id: null }).eq("user_id", userId);
    if (playerId) {
      const { error } = await supabase.from("players").update({ user_id: userId }).eq("id", playerId);
      if (error) toast.error("No se pudo enlazar (¿ya está asignado?)");
    }
    setSavingId(null); load();
  };

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return r.email.toLowerCase().includes(s) || (r.full_name ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black">Usuarios y roles</h2>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email o nombre…" className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6" />Sin usuarios.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((u) => (
              <li key={u.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{u.full_name || u.email.split("@")[0]}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    u.role === "admin" ? "bg-primary/15 text-primary" :
                    u.role === "coach" ? "bg-warning/15 text-warning" :
                    u.role === "player" ? "bg-success/15 text-success" :
                    "bg-surface-elevated text-muted-foreground"
                  }`}>{ROLE_LABEL[u.role]}</span>
                  <div className="flex w-full flex-wrap gap-1 sm:w-auto">
                    {(["parent", "player", "coach", "admin"] as Role[]).map((r) => (
                      <Button
                        key={r} size="sm"
                        variant={u.role === r ? "default" : "outline"}
                        disabled={u.role === r || savingId === u.id}
                        onClick={() => changeRole(u.id, r)}
                        className="flex-1 text-xs sm:flex-initial"
                      >
                        {r === "parent" ? "Padre" : r === "player" ? "Jugador" : r === "coach" ? "Entrenador" : "Admin"}
                      </Button>
                    ))}
                  </div>
                </div>

                {u.role === "coach" && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Equipos asignados ({u.teamIds.length})</div>
                    {teams.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay equipos en la base de datos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {teams.map((t) => {
                          const assigned = u.teamIds.includes(t.id);
                          return (
                            <button key={t.id} onClick={() => toggleTeam(u.id, t.id, assigned)} disabled={savingId === u.id}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${assigned ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:border-primary"}`}>
                              {assigned ? "✓ " : "+ "}{t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {u.role === "parent" && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Hijos/as vinculados ({u.linkedPlayerIds.length})</div>
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay jugadores en la base de datos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {players.map((p) => {
                          const linked = u.linkedPlayerIds.includes(p.id);
                          const team = teams.find((t) => t.id === p.team_id);
                          return (
                            <button key={p.id} onClick={() => toggleLinkedPlayer(u.id, p.id, linked)} disabled={savingId === u.id}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${linked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:border-primary"}`}>
                              {linked ? "✓ " : "+ "}{p.first_name} {p.last_name}{team && ` · ${team.name}`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">Un tutor puede tener varios hijos y un jugador varios tutores.</p>
                  </div>
                )}

                {u.role === "player" && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ficha del jugador</div>
                    <select
                      value={u.ownPlayerId ?? ""}
                      onChange={(e) => linkOwnPlayer(u.id, e.target.value)}
                      disabled={savingId === u.id}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="">— Sin ficha vinculada —</option>
                      {players.map((p) => {
                        const team = teams.find((t) => t.id === p.team_id);
                        const takenByOther = p.user_id && p.user_id !== u.id;
                        return (
                          <option key={p.id} value={p.id} disabled={!!takenByOther}>
                            {p.first_name} {p.last_name}{team && ` · ${team.name}`}{takenByOther ? " (ya asignada)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-2 text-[11px] text-muted-foreground">El jugador verá su equipo, calendario y clasificación al iniciar sesión.</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
