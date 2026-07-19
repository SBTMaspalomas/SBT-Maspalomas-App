import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clubStore, type Role } from "@/lib/clubStore";

export interface FamilyChild {
  id: string;
  full_name: string;
  birth_date: string | null;
  team_id: string | null;
}

export interface FamilyInfo {
  id: string;
  reference_code: string | null;
  adult_pin: string | null;
  children: FamilyChild[];
}

export type ActiveProfile =
  | { kind: "adult" }
  | { kind: "child"; childId: string };

interface AuthCtx {
  session: Session | null;
  user: User | null;
  role: Role | null;
  fullName: string | null;
  loading: boolean;
  family: FamilyInfo | null;
  activeProfile: ActiveProfile | null;
  selectAdult: (pin: string) => boolean;
  selectChild: (childId: string) => void;
  clearProfile: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, role: null, fullName: null, loading: true,
  family: null, activeProfile: null,
  selectAdult: () => false, selectChild: () => {}, clearProfile: () => {},
  signOut: async () => {},
});

// Demo PIN for the "Adultos Responsables" profile.
export const ADULT_PIN = "1234";

// Bridge to demo store: map real role → demo user id so legacy demo data keeps working.
const DEMO_USER_BY_ROLE: Record<Role, string> = {
  admin: "u-admin",
  coach: "u-coach1",
  parent: "u-parent1",
  player: "u-player1",
  family: "u-parent1",
};

async function loadRoleAndProfile(userId: string) {
  const [
    { data: roleRows, error: rolesErr },
    { data: profile, error: profileErr },
    { data: teamRows, error: teamsErr },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("coach_teams").select("team_id").eq("user_id", userId),
  ]);
  if (rolesErr) console.error("loadRoleAndProfile: error cargando roles", rolesErr);
  if (profileErr) console.error("loadRoleAndProfile: error cargando perfil", profileErr);
  if (teamsErr) console.error("loadRoleAndProfile: error cargando equipos de coach", teamsErr);

  // Priorizar admin > coach > parent > player > family
  let role: Role = "family";
  if (roleRows && roleRows.length > 0) {
    const roles = roleRows.map((r) => r.role);
    if (roles.includes("admin")) role = "admin";
    else if (roles.includes("coach")) role = "coach";
    else if (roles.includes("parent")) role = "parent";
    else if (roles.includes("player")) role = "player";
    else role = roles[0] as Role;
  }
  
  return {
    role,
    fullName: profile?.full_name ?? null,
    teamIds: (teamRows ?? []).map((r) => r.team_id),
  };
}

async function loadFamily(userId: string): Promise<FamilyInfo | null> {
  const { data: fam, error: famErr } = await supabase
    .from("families_meta")
    .select("id, reference_code, adult_pin")
    .eq("head_profile_id", userId)
    .maybeSingle();
  if (famErr) console.error("loadFamily: error cargando familia", famErr);
  if (!fam) return null;
  const { data: kids, error: kidsErr } = await supabase
    .from("players")
    .select("id, full_name, birth_date, team_id")
    .eq("family_id", fam.id)
    .order("birth_date", { ascending: true });
  if (kidsErr) console.error("loadFamily: error cargando hijos", kidsErr);
  return {
    id: fam.id,
    reference_code: fam.reference_code,
    adult_pin: (fam as any).adult_pin ?? null,
    children: (kids ?? []) as FamilyChild[],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Id del usuario cuya sesión ya procesamos por completo. Sirve para (a) deduplicar
    // la carrera entre getSession() y onAuthStateChange, y (b) NO recargar rol/familia ni
    // resetear activeProfile en eventos como TOKEN_REFRESHED (que ocurren ~cada hora).
    let loadedUserId: string | null = null;

    const apply = async (s: Session | null) => {
      setSession(s);
      if (!s?.user) {
        loadedUserId = null;
        setRole(null); setFullName(null); setFamily(null); setActiveProfile(null);
        setLoading(false);
        return;
      }

      // Si ya procesamos este usuario, no repetir la carga (evita perder el perfil activo
      // de las familias en cada refresh de token / re-emisión de INITIAL_SESSION|SIGNED_IN).
      if (loadedUserId === s.user.id) {
        setLoading(false);
        return;
      }
      // Marca optimista para deduplicar llamadas concurrentes antes del await.
      loadedUserId = s.user.id;

      const { role: r, fullName: fn, teamIds } = await loadRoleAndProfile(s.user.id);
      if (!active) return;
      setRole(r);
      setFullName(fn ?? s.user.email ?? null);

      if (r === "family") {
        const f = await loadFamily(s.user.id);
        if (!active) return;
        setFamily(f);
        // Family users must pick a profile explicitly — no auto selection.
        setActiveProfile(null);
      } else {
        setFamily(null);
        setActiveProfile({ kind: "adult" });
      }

      // Bridge to demo store for legacy views
      clubStore.set((st) => {
        const demoId = DEMO_USER_BY_ROLE[r];
        st.currentUserId = demoId;
        if (r === "coach") {
          const u = st.users.find((x) => x.id === demoId);
          if (u) u.teamIds = teamIds;
        }
      });
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => apply(s), 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const selectAdult = useCallback((pin: string) => {
    const realPin = family?.adult_pin || ADULT_PIN;
    if (pin !== realPin) return false;
    setActiveProfile({ kind: "adult" });
    return true;
  }, [family]);
  const selectChild = useCallback((childId: string) => {
    setActiveProfile({ kind: "child", childId });
  }, []);
  const clearProfile = useCallback(() => setActiveProfile(null), []);

  const signOut = async () => {
    setActiveProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{
      session, user: session?.user ?? null, role, fullName, loading,
      family, activeProfile, selectAdult, selectChild, clearProfile, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
