import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Search, RefreshCw, Baby } from "lucide-react";

type Role = "admin" | "coach" | "family";

interface TeamRow { id: string; name: string; category: string; }
interface PlayerRow { id: string; full_name: string; birth_date: string | null; team_id: string | null; family_id: string | null; }
interface FamilyRow { id: string; head_email: string | null; head_profile_id: string | null; reference_code: string | null; }

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  teamIds: string[];       // coach
  familyId: string | null; // family (head_profile_id)
  referenceCode: string | null;
  childCount: number;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coach: "Entrenador",
  family: "Familia",
};

export function RoleManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: profiles, error: pErr },
      { data: roles, error: rErr },
      { data: ct, error: ctErr },
      { data: teamsData, error: tErr },
      { data: playersData, error: plErr },
      { data: familiesData, error: fErr },
    ] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("coach_teams").select("user_id, team_id"),
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("players").select("id, full_name, birth_date, team_id, family_id").order("birth_date"),
      supabase.from("families_meta").select("id, head_email, head_profile_id, reference_code"),
    ]);
    if (pErr || rErr || ctErr || tErr || plErr || fErr) {
      toast.error("No se pudieron cargar los datos");
      setLoading(false); return;
    }
    setTeams((teamsData ?? []) as TeamRow[]);
    setPlayers((playersData ?? []) as PlayerRow[]);
    setFamilies((familiesData ?? []) as FamilyRow[]);

    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    const teamMap = new Map<string, string[]>();
    (ct ?? []).forEach((r) => {
      const arr = teamMap.get(r.user_id) ?? []; arr.push(r.team_id); teamMap.set(r.user_id, arr);
    });
    const famByHead = new Map<string, FamilyRow>();
    (familiesData ?? []).forEach((f) => { if (f.head_profile_id) famByHead.set(f.head_profile_id, f as FamilyRow); });
    const childCountByFam = new Map<string, number>();
    (playersData ?? []).forEach((p) => {
      if (!p.family_id) return;
      childCountByFam.set(p.family_id, (childCountByFam.get(p.family_id) ?? 0) + 1);
    });

    setRows(
      (profiles ?? []).map((p) => {
        const fam = famByHead.get(p.id) ?? null;
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: (roleMap.get(p.id) ?? "family") as Role,
          teamIds: teamMap.get(p.id) ?? [],
          familyId: fam?.id ?? null,
          referenceCode: fam?.reference_code ?? null,
          childCount: fam ? (childCountByFam.get(fam.id) ?? 0) : 0,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, newRole: Role) => {
    setSavingId(userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as "admin" | "coach" });
    if (insErr) { toast.error("Error al asignar rol"); setSavingId(null); return; }
    if (newRole !== "coach") await supabase.from("coach_teams").delete().eq("user_id", userId);
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}`);
    setSavingId(null); load();
  };

  const toggleTeam = async (userId: string, teamId: string, assigned: boolean) => {
    setSavingId(userId);
    if (assigned) await supabase.from("coach_teams").delete().eq("user_id", userId).eq("team_id", teamId);
    else await supabase.from("coach_teams").insert({ user_id: userId, team_id: teamId });
    setSavingId(null); load();
  };

  const ensureFamily = async (userId: string, email: string): Promise<string | null> => {
    // Try to find an existing family for this user (or one that matches their email)
    const existing = families.find((f) => f.head_profile_id === userId)
      ?? families.find((f) => f.head_email === email && !f.head_profile_id);
    if (existing) {
      if (!existing.head_profile_id) {
        await supabase.from("families_meta").update({ head_profile_id: userId }).eq("id", existing.id);
      }
      return existing.id;
    }
    const { data: created, error } = await supabase
      .from("families_meta")
      .insert({ head_profile_id: userId, head_email: email })
      .select("id")
      .single();
    if (error || !created) { toast.error("No se pudo crear la familia"); return null; }
    return created.id;
  };

  const toggleChild = async (userId: string, email: string, playerId: string, currentFamilyId: string | null) => {
    setSavingId(userId);
    const famId = await ensureFamily(userId, email);
    if (!famId) { setSavingId(null); return; }
    const isMine = currentFamilyId === famId;
    const { error } = await supabase
      .from("players")
      .update({ family_id: isMine ? null : famId })
      .eq("id", playerId);
    if (error) toast.error("No se pudo actualizar la vinculación");
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
                    "bg-surface-elevated text-muted-foreground"
                  }`}>{ROLE_LABEL[u.role]}</span>
                  <div className="flex w-full flex-wrap gap-1 sm:w-auto">
                    {(["family", "coach", "admin"] as Role[]).map((r) => (
                      <Button
                        key={r} size="sm"
                        variant={u.role === r ? "default" : "outline"}
                        disabled={u.role === r || savingId === u.id}
                        onClick={() => changeRole(u.id, r)}
                        className="flex-1 text-xs sm:flex-initial"
                      >
                        {ROLE_LABEL[r]}
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

                {u.role === "family" && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Hijos/as vinculados ({u.childCount})
                      </div>
                      {u.referenceCode && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                          {u.referenceCode}
                        </span>
                      )}
                    </div>
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay jugadores en la base de datos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {players.map((p) => {
                          const mine = u.familyId && p.family_id === u.familyId;
                          const takenByOther = p.family_id && !mine;
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggleChild(u.id, u.email, p.id, p.family_id)}
                              disabled={savingId === u.id || !!takenByOther}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                mine ? "border-primary bg-primary text-primary-foreground" :
                                takenByOther ? "border-border bg-surface/50 text-muted-foreground opacity-60" :
                                "border-border bg-surface text-foreground hover:border-primary"
                              }`}
                              title={takenByOther ? "Ya vinculado a otra familia" : ""}
                            >
                              <Baby className="mr-1 inline h-3 w-3" />
                              {p.full_name}{p.team_id && ` · ${p.team_id}`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Al vincular un hijo se crea automáticamente la ficha de familia (código: <span className="font-mono">Nombre.Inicial-AA</span>).
                    </p>
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
