import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Search, RefreshCw } from "lucide-react";

type Role = "admin" | "coach" | "parent";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coach: "Entrenador",
  parent: "Padre / Tutor",
};

export function RoleManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error("No se pudieron cargar los usuarios");
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleMap.get(p.id) ?? "parent",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, newRole: Role) => {
    setSavingId(userId);
    // Replace role: delete existing + insert new (user_roles has UNIQUE(user_id, role))
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error("Error al actualizar rol"); setSavingId(null); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error("Error al asignar rol"); setSavingId(null); return; }
    setRows((rs) => rs.map((r) => (r.id === userId ? { ...r, role: newRole } : r)));
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}`);
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
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
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
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Al asignar el rol <strong>Entrenador</strong> a un usuario, al iniciar sesión accederá
        únicamente a la vista de su equipo (asistencia y comunicación). La vinculación de cada
        entrenador con un equipo específico se gestionará en la Fase 2, cuando los equipos vivan
        en la base de datos.
      </p>
    </div>
  );
}
