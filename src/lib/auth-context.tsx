import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clubStore, type Role } from "@/lib/clubStore";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  role: Role | null;
  fullName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, role: null, fullName: null, loading: true,
  signOut: async () => {},
});

// Map authenticated role to a demo user id so existing demo data keeps working
const DEMO_USER_BY_ROLE: Record<Role, string> = {
  admin: "u-admin",
  coach: "u-coach1",
  parent: "u-parent1",
};

async function loadRoleAndProfile(userId: string) {
  const [{ data: roleRow }, { data: profile }, { data: teamRows }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("coach_teams").select("team_id").eq("user_id", userId),
  ]);
  return {
    role: (roleRow?.role ?? "parent") as Role,
    fullName: profile?.full_name ?? null,
    teamIds: (teamRows ?? []).map((r) => r.team_id),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const apply = async (s: Session | null) => {
      setSession(s);
      if (!s?.user) {
        setRole(null);
        setFullName(null);
        setLoading(false);
        return;
      }
      const { role: r, fullName: fn } = await loadRoleAndProfile(s.user.id);
      if (!active) return;
      setRole(r);
      setFullName(fn ?? s.user.email ?? null);
      // Bridge to demo store so existing UI/data keeps working
      clubStore.set((st) => { st.currentUserId = DEMO_USER_BY_ROLE[r]; });
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer Supabase calls out of the listener
      setTimeout(() => apply(s), 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, role, fullName, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
