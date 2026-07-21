import { useState, useMemo, useEffect } from "react";
import { useAuth, ADULT_PIN, type FamilyChild } from "@/lib/auth-context";
import { useMatches } from "@/hooks/use-matches";
import { type MatchRow } from "@/lib/matches";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { UserCog, Baby, ShieldCheck, CalendarDays, ArrowLeft, LogOut, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "./AvatarUpload";

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
      toast.error("PIN incorrecto");
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
            <p className="mt-1 text-sm text-muted-foreground">Introduce el PIN de 4 dígitos para acceder.</p>
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
          {family?.reference_code ? (
            <>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">Cuenta {family.reference_code}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Selecciona un perfil</p>
            </>
          ) : (
            <>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">¿Quién está viendo?</h1>
              <p className="mt-2 text-sm text-muted-foreground">Selecciona un perfil</p>
            </>
          )}
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
        <FamilyTeams children={children} />

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!child.team_id) return;
    // team_id puede ser un UUID o un nombre (datos mixtos); cargar y emparejar por id o name
    // para no lanzar 22P02 (invalid uuid) al filtrar por .eq("id", <nombre>).
    supabase.from("teams").select("id, name, category")
      .then(({ data }) => {
        const t = (data ?? []).find((x) => x.id === child.team_id || x.name === child.team_id);
        if (t) setTeamName(`${t.name} (${t.category})`);
      });
  }, [child.team_id]);

  useEffect(() => {
    supabase.from("players").select("avatar_url").eq("id", child.id).maybeSingle()
      .then(({ data }) => {
        if (data && data.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [child.id]);

  return (
    <div className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-transform hover:-translate-y-1">
      <div className="relative">
        <button onClick={onClick} className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-success/70 to-primary/60 text-primary-foreground shadow-lg ring-2 ring-transparent transition-all group-hover:ring-primary sm:h-28 sm:w-28 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={child.full_name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-black sm:text-3xl">{initials(child.full_name)}</span>
          )}
        </button>
        <AvatarUpload
          currentUrl={avatarUrl}
          entityId={child.id}
          entityType="player"
          onUploaded={(url) => setAvatarUrl(url)}
        />
      </div>
      <button onClick={onClick} className="text-center">
        <div className="text-sm font-bold">{child.full_name}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {teamName ?? (child.team_id ? "Cargando..." : "SIN EQUIPO")}
        </div>
        {age !== null && <div className="text-[10px] text-muted-foreground">{age} años</div>}
      </button>
    </div>
  );
}

function FamilyTeams({ children }: { children: FamilyChild[] }) {
  const [teams, setTeams] = useState<Array<{id: string; name: string; category: string}>>([]);

  useEffect(() => {
    // Cargar todos los equipos y emparejar en cliente por id o name (team_id puede ser
    // un UUID o un nombre); filtrar por .in("id", <nombres>) lanzaría 22P02.
    const teamKeys = children.map(c => c.team_id).filter(Boolean) as string[];
    if (teamKeys.length > 0) {
      supabase.from("teams").select("id, name, category")
        .then(({ data }) => { if (data) setTeams(data); });
    }
  }, [children]);

  if (children.length === 0) return null;

  return (
    <div className="space-y-4">
      {teams.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-wide">Equipos</h3>
          </div>
          <div className="space-y-2">
            {children.map((child) => {
              const team = teams.find(t => t.id === child.team_id || t.name === child.team_id);
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
    </div>
  );
}

function FamilyAgenda({ children }: { children: FamilyChild[] }) {
  const { matches } = useMatches();
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const keys = children.map((c) => c.team_id).filter(Boolean);
    if (keys.length === 0) return;
    // team_id del hijo puede ser UUID o nombre; se empareja en cliente.
    supabase.from("teams").select("id, name").then(({ data }) => { if (data) setTeams(data); });
  }, [children]);

  const items = useMemo(() => {
    if (children.length === 0) return [];
    // UUID de equipo (principal) de cada hijo.
    const childTeamUuid = new Map<string, string | null>();
    children.forEach((c) => {
      const t = teams.find((x) => x.id === c.team_id || x.name === c.team_id);
      childTeamUuid.set(c.id, t?.id ?? null);
    });
    const rows: { match: MatchRow; child: FamilyChild }[] = [];
    children.forEach((c) => {
      const uuid = childTeamUuid.get(c.id);
      if (!uuid) return;
      matches.filter((m) => m.team_id === uuid).forEach((m) => rows.push({ match: m, child: c }));
    });
    return rows
      .sort((a, b) =>
        (a.match.match_date + (a.match.match_time ?? "")).localeCompare(
          b.match.match_date + (b.match.match_time ?? ""),
        ),
      )
      .slice(0, Math.max(children.length * 2, 3));
  }, [matches, children, teams]);

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
                    {new Date(match.match_date).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })}{match.match_time ? ` · ${match.match_time}` : ""}
                  </span>
                  <span className="text-muted-foreground"> — juega </span>
                  <span className="font-bold">{child.full_name.split(" ")[0]}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  vs {match.opponent} · {match.is_home ? "en casa" : "fuera"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
