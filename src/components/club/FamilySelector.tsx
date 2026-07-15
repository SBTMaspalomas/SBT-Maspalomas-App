import { useState, useMemo, useEffect } from "react";
import { useAuth, ADULT_PIN, type FamilyChild } from "@/lib/auth-context";
import { useClub } from "@/lib/clubStore";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { UserCog, Baby, ShieldCheck, CalendarDays, ArrowLeft, LogOut, Trophy, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function ageFrom(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth); const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function FamilySelector() {
  const auth = useAuth();
  const [mode, setMode] = useState<"pick" | "pin">("pick");
  const [pin, setPin] = useState("");

  const family = auth.family;
  const children = family?.children ?? [];

  const handleSubmitPin = (value: string) => {
    if (auth.selectAdult(value)) {
      toast.success("Bienvenido, adulto responsable");
    } else {
      setPin("");
      toast.error("PIN incorrecto. Prueba con 1234 (demo).");
    }
  };

  if (mode === "pin") {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-surface p-6">
        <div className="mx-auto max-w-sm space-y-6 text-center">
          <button onClick={() => { setMode("pick"); setPin(""); }} className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> volver a perfiles
          </button>
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Adultos Responsables</h2>
            <p className="mt-1 text-sm text-muted-foreground">Introduce el PIN de 4 dígitos para gestionar la familia.</p>
          </div>
          <div className="flex justify-center">
            <InputOTP
              maxLength={4} value={pin}
              onChange={(v) => { setPin(v); if (v.length === 4) handleSubmitPin(v); }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-14 text-xl" />
                <InputOTPSlot index={1} className="h-14 w-14 text-xl" />
                <InputOTPSlot index={2} className="h-14 w-14 text-xl" />
                <InputOTPSlot index={3} className="h-14 w-14 text-xl" />
              </InputOTPGroup>
            </InputOTP>
         </div>
          <p className="text-[11px] text-muted-foreground">Introduce tu PIN personal de 4 dígitos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-surface px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-primary">SBT Maspalomas</div>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">¿Quién está viendo?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {auth.fullName ? `Cuenta: ${auth.fullName}` : "Selecciona un perfil"}
            {family?.reference_code && <> · Familia <span className="font-mono font-semibold text-foreground">{family.reference_code}</span></>}
          </p>
        </div>

        <div className="mx-auto grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ProfileTile
            label="Adultos Responsables"
            sub="PIN protegido"
            tone="primary"
            icon={<UserCog className="h-10 w-10" />}
            onClick={() => setMode("pin")}
          />
          {children.map((c) => (
            <ChildTile key={c.id} child={c} onClick={() => auth.selectChild(c.id)} />
          ))}
          {children.length === 0 && (
            <div className="col-span-1 rounded-2xl border border-dashed border-border bg-surface p-4 text-center text-xs text-muted-foreground sm:col-span-3">
              Aún no hay hijos vinculados a esta cuenta. Completa el registro federativo para inscribir a tus hijos.
            </div>
          )}
        </div>

        {/* Resumen de equipos y cuotas */}
        <FamilyTeamsAndFees children={children} familyId={family?.id ?? null} />

        <FamilyAgenda children={children} />

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => auth.signOut()}>
            <LogOut className="mr-1 h-3.5 w-3.5" /> cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileTile({
  label, sub, icon, tone, onClick,
}: { label: string; sub?: string; icon: React.ReactNode; tone?: "primary" | "child"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-1"
    >
      <div className={`grid h-24 w-24 place-items-center rounded-2xl shadow-lg ring-2 ring-transparent transition-all group-hover:ring-primary sm:h-28 sm:w-28 ${
        tone === "primary" ? "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground" : "bg-gradient-to-br from-surface-elevated to-surface text-foreground"
      }`}>
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{label}</div>
        {sub && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</div>}
      </div>
    </button>
  );
}

function ChildTile({ child, onClick }: { child: FamilyChild; onClick: () => void }) {
  const age = ageFrom(child.birth_date);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!child.team_id) return;
    supabase.from("teams").select("name, category").eq("id", child.team_id).maybeSingle()
      .then(({ data }) => {
        if (data) setTeamName(`${data.name} (${data.category})`);
      });
  }, [child.team_id]);

  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-1">
      <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-success/70 to-primary/60 text-primary-foreground shadow-lg ring-2 ring-transparent transition-all group-hover:ring-primary sm:h-28 sm:w-28">
        <span className="text-2xl font-black sm:text-3xl">{initials(child.full_name)}</span>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{child.full_name}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {teamName ?? (child.team_id ? "Cargando..." : "SIN EQUIPO")}
        </div>
        {age !== null && <div className="text-[10px] text-muted-foreground">{age} años</div>}
      </div>
    </button>
  );
}

function FamilyTeamsAndFees({ children, familyId }: { children: FamilyChild[]; familyId: string | null }) {
  const [teams, setTeams] = useState<Array<{id: string; name: string; category: string}>>([]);
  const [payments, setPayments] = useState<Array<{id: string; amount: number; period: string; paid: boolean; player_name: string}>>([]);

  useEffect(() => {
    // Cargar equipos de los hijos
    const teamIds = children.map(c => c.team_id).filter(Boolean) as string[];
    if (teamIds.length > 0) {
      supabase.from("teams").select("id, name, category").in("id", teamIds)
        .then(({ data }) => { if (data) setTeams(data); });
    }
    // Cargar cuotas de la familia
    if (familyId) {
      supabase.from("payments").select("id, amount, period, paid, player_name").eq("family_id", familyId).order("created_at", { ascending: false })
        .then(({ data }) => { if (data) setPayments(data as any); });
    }
  }, [children, familyId]);

  if (children.length === 0) return null;

  const pendingPayments = payments.filter(p => !p.paid);
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Equipos de los hijos */}
      {teams.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-wide">Equipos de tus hijos</h3>
          </div>
          <div className="space-y-2">
            {children.map((child) => {
              const team = teams.find(t => t.id === child.team_id);
              if (!team) return null;
              return (
                <div key={child.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Baby className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{child.full_name}</div>
                    <div className="text-xs text-muted-foreground">{team.name} · {team.category}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cuotas pendientes */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wide">Cuotas</h3>
          {totalPending > 0 && (
            <span className="ml-auto rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
              {totalPending.toFixed(2)}€ pendiente
            </span>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cuotas registradas aún.</p>
        ) : (
          <ul className="space-y-2">
            {payments.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{p.period}</div>
                  <div className="text-xs text-muted-foreground">{p.player_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{p.amount?.toFixed(2)}€</div>
                  <div className={`text-[10px] font-semibold ${p.paid ? "text-success" : "text-destructive"}`}>
                    {p.paid ? "Pagado" : "Pendiente"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FamilyAgenda({ children }: { children: FamilyChild[] }) {
  const matches = useClub((s) => s.matches);

  const items = useMemo(() => {
    if (children.length === 0) return [];
    const upcoming = [...matches]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, Math.max(children.length * 2, 3));
    return upcoming.map((m, i) => {
      const child = children[i % children.length];
      return { match: m, child };
    });
  }, [matches, children]);

  if (children.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-wide">PLAN SEMANAL</h3>
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Semana en curso</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin partidos programados esta semana.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ match, child }) => (
            <li key={match.id + child.id} className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Baby className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-semibold">
                    {new Date(match.date).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })} · {match.time}
                  </span>
                  <span className="text-muted-foreground"> — juega </span>
                  <span className="font-bold">{child.full_name.split(" ")[0]}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  vs {match.opponent} · {match.venue === "home" ? "en casa" : "fuera"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
