import { useMemo, useState } from "react";
import { useAuth, ADULT_PIN, type FamilyChild } from "@/lib/auth-context";
import { useClub } from "@/lib/clubStore";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { UserCog, Baby, ShieldCheck, CalendarDays, ArrowLeft, LogOut } from "lucide-react";

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
          <p className="text-[11px] text-muted-foreground">PIN de prueba: <span className="font-mono font-bold">{ADULT_PIN}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-surface px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-primary">Club Hoops</div>
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
              Aún no hay hijos vinculados a esta cuenta. Pide al administrador del club que enlace los jugadores a tu familia.
            </div>
          )}
        </div>

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
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-1">
      <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-success/70 to-primary/60 text-primary-foreground shadow-lg ring-2 ring-transparent transition-all group-hover:ring-primary sm:h-28 sm:w-28">
        <span className="text-2xl font-black sm:text-3xl">{initials(child.full_name)}</span>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{child.full_name}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {child.team_id?.toUpperCase() ?? "SIN EQUIPO"}
        </div>
      </div>
    </button>
  );
}

function FamilyAgenda({ children }: { children: FamilyChild[] }) {
  const matches = useClub((s) => s.matches);

  // Cross demo matches with the family's kids by loose team_id text match on team names.
  // Fallback: show upcoming demo matches labelled per child if names roughly match categories.
  const items = useMemo(() => {
    if (children.length === 0) return [];
    // Simple demo cross-match: assign the next N demo matches to the children round-robin.
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
                  <span className="text-muted-foreground"> ({child.team_id ?? "equipo"})</span>
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
