import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Search, RefreshCw } from "lucide-react";
import { useClub } from "@/lib/clubStore";

type Role = "admin" | "coach" | "parent";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  teamIds: string[];
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coach: "Entrenador",
  parent: "Padre / Tutor",
};

export function RoleManager() {
  const teams = useClub((s) => s.teams);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: ct, error: ctErr }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("coach_teams").select("user_id, team_id"),
    ]);
    if (pErr || rErr || ctErr) {
      toast.error("No se pudieron cargar los usuarios");
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    const teamMap = new Map<string, string[]>();
    (ct ?? []).forEach((r) => {
      const arr = teamMap.get(r.user_id) ?? [];
      arr.push(r.team_id);
      teamMap.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleMap.get(p.id) ?? "parent",
        teamIds: teamMap.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, newRole: Role) => {
    setSavingId(userId);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error("Error al actualizar rol"); setSavingId(null); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error("Error al asignar rol"); setSavingId(null); return; }
    // If demoted from coach, clear team assignments
    if (newRole !== "coach") {
      await supabase.from("coach_teams").delete().eq("user_id", userId);
      setRows((rs) => rs.map((r) => (r.id === userId ? { ...r, role: newRole, teamIds: [] } : r)));
    } else {
      setRows((rs) => rs.map((r) => (r.id === userId ? { ...r, role: newRole } : r)));
    }
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}`);
    setSavingId(null);
  };

  const toggleTeam = async (userId: string, teamId: string, assigned: boolean) => {
    setSavingId(userId);
    if (assigned) {
      const { error } = await supabase.from("coach_teams").delete().eq("user_id", userId).eq("team_id", teamId);
      if (error) { toast.error("Error al quitar equipo"); setSavingId(null); return; }
      setRows((rs) => rs.map((r) => r.id === userId ? { ...r, teamIds: r.teamIds.filter((t) => t !== teamId) } : r));
    } else {
      const { error } = await supabase.from("coach_teams").insert({ user_id: userId, team_id: teamId });
      if (error) { toast.error("Error al asignar equipo"); setSavingId(null); return; }
      setRows((rs) => rs.map((r) => r.id === userId ? { ...r, teamIds: [...r.teamIds, teamId] } : r));
    }
    setSavingId(null);
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
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por email o nombre…"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6" />
            Sin usuarios.
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
                  <div className="flex w-full gap-1 sm:w-auto">
                    {(["parent", "coach", "admin"] as Role[]).map((r) => (
                      <Button
                        key={r}
                        size="sm"
                        variant={u.role === r ? "default" : "outline"}
                        disabled={u.role === r || savingId === u.id}
                        onClick={() => changeRole(u.id, r)}
                        className="flex-1 text-xs sm:flex-initial"
                      >
                        {r === "parent" ? "Padre" : r === "coach" ? "Entrenador" : "Admin"}
                      </Button>
                    ))}
                  </div>
                </div>

                {u.role === "coach" && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Equipos asignados ({u.teamIds.length})
                    </div>
                    {teams.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay equipos disponibles.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {teams.map((t) => {
                          const assigned = u.teamIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => toggleTeam(u.id, t.id, assigned)}
                              disabled={savingId === u.id}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                assigned
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-surface text-foreground hover:border-primary"
                              }`}
                            >
                              {assigned ? "✓ " : "+ "}{t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Un entrenador puede tener varios equipos y un equipo varios entrenadores.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Al asignar el rol <strong>Entrenador</strong>, marca debajo a qué equipos tendrá acceso.
        Las asignaciones se aplicarán completamente cuando los equipos vivan en la base de datos (Fase 2).
      </p>
    </div>
  );
}
