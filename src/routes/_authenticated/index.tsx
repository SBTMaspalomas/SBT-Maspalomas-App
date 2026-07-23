import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { useAuth } from "@/lib/auth-context";
import { useClubData } from "@/hooks/use-club-data";
import { RegistrationFlow } from "@/components/club/RegistrationFlow";
import { supabase } from "@/integrations/supabase/client";
import { ValidationConsole } from "@/components/club/ValidationConsole";
import { PaymentsAdmin, PaymentsParent } from "@/components/club/Payments";
import { Attendance } from "@/components/club/Attendance";
import { Chats } from "@/components/club/Chats";
import { NewsBoard } from "@/components/club/NewsBoard";
import { RoleManager } from "@/components/club/RoleManager";
import { FamilyProvisioning } from "@/components/club/FamilyProvisioning";
import { PlayerView } from "@/components/club/PlayerView";
import { FamilySelector } from "@/components/club/FamilySelector";
import { TeamsManager } from "@/components/club/TeamsManager";
import { ConvocatoriesManager } from "@/components/club/ConvocatoriesManager";
import { ConvocatoriesPlayer } from "@/components/club/ConvocatoriesPlayer";
import { FederativaDoc } from "@/components/club/FederativaDoc";
import { PlayerDocuments } from "@/components/club/PlayerDocuments";
import { DorsalManager } from "@/components/club/DorsalManager";
import { EquipmentSizes } from "@/components/club/EquipmentSizes";
import { MatchesManager } from "@/components/club/MatchesManager";
import { useMatches } from "@/hooks/use-matches";
import type { Role } from "@/lib/clubStore";
import {
  LayoutDashboard, FileSignature, ShieldCheck, Wallet, ClipboardCheck, MessagesSquare, Newspaper, RefreshCw, Menu, X, LogOut, Users, Trophy, ArrowLeftRight, Users2, Zap, FileText, Shirt, Hash, CalendarDays, IdCard, KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "SBT Maspalomas · Gestión del Club" },
      { name: "description", content: "Plataforma móvil de gestión integral para club de baloncesto: registros federativos, cuotas, asistencia, chats y cartelera." },
    ],
  }),
  component: ClubApp,
});

type View = "inicio" | "registro" | "validacion" | "pagos" | "asistencia" | "chats" | "cartelera" | "roles" | "mizona" | "miembros" | "equipos" | "convocatorias" | "mis-convocatorias" | "federativa" | "fichas" | "dorsales" | "tallas" | "partidos" | "cuentas";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard, roles: ["admin", "coach", "parent", "player", "family", "senior", "staff"] },
  // "Mi zona" pendiente de desarrollo — oculto hasta nueva orden.
  { id: "mizona", label: "Mi zona", icon: Trophy, roles: [] },
  { id: "cartelera", label: "Cartelera", icon: Newspaper, roles: ["admin", "coach", "parent", "family", "senior", "staff"] },
  { id: "partidos", label: "Partidos", icon: CalendarDays, roles: ["admin", "coach", "parent", "family", "senior", "staff"] },
  { id: "registro", label: "Registro federativo", icon: FileSignature, roles: ["admin", "parent", "family"] },
  { id: "federativa", label: "Ficha federativa", icon: FileText, roles: ["family", "senior"] },
  { id: "miembros", label: "Miembros", icon: Users2, roles: ["admin"] },
  { id: "cuentas", label: "Cuentas de familias", icon: KeyRound, roles: ["admin"] },
  { id: "fichas", label: "Fichas jugadores", icon: IdCard, roles: ["admin"] },
  { id: "equipos", label: "Equipos", icon: Zap, roles: ["admin"] },
  { id: "convocatorias", label: "Convocatorias", icon: ClipboardCheck, roles: ["admin", "coach"] },
  { id: "mis-convocatorias", label: "Mis Convocatorias", icon: ClipboardCheck, roles: ["player", "senior"] },
  { id: "dorsales", label: "Dorsales", icon: Hash, roles: ["admin", "coach"] },
  { id: "tallas", label: "Tallas / Equipación", icon: Shirt, roles: ["family", "senior"] },
  { id: "validacion", label: "Validación docs.", icon: ShieldCheck, roles: ["admin"] },
  { id: "pagos", label: "Cuotas y pagos", icon: Wallet, roles: ["admin", "parent", "family", "senior"] },
  { id: "asistencia", label: "Control de asistencia", icon: ClipboardCheck, roles: ["coach"] },
  { id: "chats", label: "Chats", icon: MessagesSquare, roles: ["admin", "coach", "parent", "player", "family", "senior", "staff"] },
];

function ClubApp() {
  const auth = useAuth();
  useClubData();
  const navigate = useNavigate();
  const user = useClub(currentUser);
  const [view, setView] = useState<View>("inicio");
  const [navOpen, setNavOpen] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState<boolean | null>(null);

  // Verificar si el usuario ya completó el registro federativo
  useEffect(() => {
    if (!auth.user || auth.role === "admin" || auth.role === "coach") {
      setRegistrationComplete(true); // Admins y coaches no necesitan registro federativo
      return;
    }
    const checkRegistration = async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id")
        .eq("user_id", auth.user!.id)
        .eq("type", "adult")
        .limit(1);
      if (error) { setRegistrationComplete(true); return; } // En caso de error, no bloquear
      setRegistrationComplete(data && data.length > 0);
    };
    checkRegistration();
  }, [auth.user, auth.role]);

  useEffect(() => {
    const onOpen = () => setView("chats");
    window.addEventListener("open-private-chat", onOpen as EventListener);
    return () => window.removeEventListener("open-private-chat", onOpen as EventListener);
  }, []);

  // Si no hay rol tras cargar (ej: tras signOut desde panel adulto), redirigir a auth.
  // Debe hacerse en un efecto, no durante el render.
  useEffect(() => {
    if (!auth.loading && !auth.role) {
      navigate({ to: "/auth" });
    }
  }, [auth.loading, auth.role, navigate]);

  // Cuentas provisionadas por el club: forzar el cambio de la contraseña temporal
  // en el primer acceso, antes de cualquier otra pantalla (incluido el registro).
  useEffect(() => {
    if (!auth.loading && auth.mustChangePassword) {
      navigate({ to: "/set-password" });
    }
  }, [auth.loading, auth.mustChangePassword, navigate]);

  // Show loading state while auth is being resolved
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // If no role is set yet, show a fallback while the redirect effect runs
  if (!auth.role) {
    return null;
  }

  // Mientras se redirige a /set-password no renderizamos el panel ni el registro.
  if (auth.mustChangePassword) {
    return null;
  }

  const handleSignOut = async () => {
    await auth.signOut();
    navigate({ to: "/auth" });
  };

  // Family role: show Netflix-style profile selector until a profile is chosen
  // Si el usuario no ha completado el registro federativo, forzar RegistrationFlow
  if ((auth.role === "family" || auth.role === "parent") && registrationComplete === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Toaster theme="dark" position="top-center" />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <h2 className="text-lg font-bold text-primary">Completa tu registro federativo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Para acceder a tu panel de familia, primero debes completar tus datos personales y documentación.</p>
          </div>
          <RegistrationFlow onComplete={() => setRegistrationComplete(true)} />
        </div>
      </div>
    );
  }

  // Si aún estamos verificando el registro, mostrar loading
  if ((auth.role === "family" || auth.role === "parent") && registrationComplete === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Verificando registro...</p>
        </div>
      </div>
    );
  }

  if (auth.role === "family" && !auth.activeProfile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Toaster theme="dark" position="top-center" />
        <FamilySelector />
      </div>
    );
  }

  // Family + child profile → render PlayerView for that child
  const isChildProfile = auth.role === "family" && auth.activeProfile?.kind === "child";
  const childId = isChildProfile && auth.activeProfile?.kind === "child" ? auth.activeProfile.childId : undefined;
  const activeChild = childId && auth.family
    ? auth.family.children.find((c) => c.id === childId) ?? null
    : null;

  // Determine effective role for menu filtering (child profile behaves like 'player')
  const effectiveRole: Role = isChildProfile ? "player" : (auth.role ?? user?.role ?? "family");
  const items = NAV.filter((n) => n.roles.includes(effectiveRole));

  const displayName = isChildProfile
    ? (activeChild?.full_name ?? "Jugador/a")
    : (auth.fullName || auth.user?.email || user?.name || "Usuario");
  const roleLabel = isChildProfile
    ? "Perfil jugador/a"
    : auth.role === "admin" ? "Administrador"
    : auth.role === "coach" ? "Entrenador"
    : auth.role === "family" ? "Adultos Responsables"
    : auth.role === "senior" ? "Jugador Senior"
    : auth.role === "staff" ? "Staff"
    : "Usuario";
  const initials = displayName.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button className="shrink-0 lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-label="menu">
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <img src="https://kiifznmcpyvalupdtnrq.supabase.co/storage/v1/object/public/avatars/SBT%20logo-.png" alt="SBT Maspalomas" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-wider">SBT Maspalomas</div>
              <div className="truncate text-[11px] text-muted-foreground">El Baloncesto en el Sur · Gran Canaria</div>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 sm:flex-initial">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">{initials || "U"}</div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold">{displayName}</div>
                <div className="truncate text-[10px] text-primary">{roleLabel}</div>
              </div>
            </div>
            {auth.role === "family" && (
              <Button variant="outline" size="icon" onClick={() => { auth.clearProfile(); setView("inicio"); }} title="Cambiar de perfil">
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => { clubStore.reset(); setView("inicio"); }} title="Reiniciar datos demo">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleSignOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className={`${navOpen ? "block" : "hidden"} lg:block`}>
          <nav className="space-y-1 rounded-xl border border-border bg-surface p-2">
            {items.map((n) => {
              const I = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { setView(n.id); setNavOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-surface-elevated"}`}
                >
                  <I className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-semibold text-foreground">Sesión activa</div>
            {displayName} <span className="text-primary">· {roleLabel}</span>
            {auth.family?.reference_code && (
              <div className="mt-1">Cuenta: <span className="font-mono font-semibold text-foreground">{auth.family.reference_code}</span></div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-4">
          {isChildProfile ? (
            <>
              {(view === "inicio" || view === "mizona") && <PlayerView childId={childId} />}
              {view === "mis-convocatorias" && <ConvocatoriesPlayer playerId={childId} />}
              {view === "chats" && <Chats />}
              {view === "cartelera" && <NewsBoard />}
            </>
          ) : (
            <>
              {view === "inicio" && <Home setView={setView} effectiveRole={effectiveRole} />}
              {view === "mizona" && <PlayerView />}
              {view === "cartelera" && <NewsBoard />}
              {view === "partidos" && <MatchesManager />}
              {view === "registro" && <RegistrationFlow />}
              {view === "miembros" && auth.role === "admin" && <RoleManager />}
              {view === "cuentas" && auth.role === "admin" && <FamilyProvisioning />}
              {view === "fichas" && auth.role === "admin" && <PlayerDocuments />}
              {view === "equipos" && auth.role === "admin" && <TeamsManager />}
              {view === "convocatorias" && (auth.role === "admin" || auth.role === "coach") && <ConvocatoriesManager />}
              {view === "mis-convocatorias" && auth.role === "player" && <ConvocatoriesPlayer />}
              {view === "mis-convocatorias" && auth.role === "senior" && <ConvocatoriesPlayer playerId={auth.selfPlayerId ?? undefined} />}
              {view === "federativa" && (auth.role === "family" || auth.role === "senior") && <FederativaDoc />}
              {view === "dorsales" && (auth.role === "admin" || auth.role === "coach") && <DorsalManager />}
              {view === "tallas" && auth.role === "family" && <EquipmentSizes />}
              {view === "tallas" && auth.role === "senior" && <EquipmentSizes playerId={auth.selfPlayerId ?? undefined} />}
              {view === "validacion" && auth.role === "admin" && <ValidationConsole />}
              {view === "pagos" && auth.role === "admin" && <PaymentsAdmin />}
              {view === "pagos" && (auth.role === "parent" || auth.role === "family") && <PaymentsParent />}
              {view === "pagos" && auth.role === "senior" && <PaymentsParent playerId={auth.selfPlayerId ?? undefined} />}
              {view === "asistencia" && auth.role === "coach" && <Attendance />}
              {view === "chats" && <Chats />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Home({ setView, effectiveRole }: { setView: (v: View) => void; effectiveRole: Role }) {
  const auth = useAuth();
  const user = useClub(currentUser);
  const players = useClub((s) => s.players);
  const { matches } = useMatches();
  const displayName = auth.fullName || auth.user?.email || user?.name || "Usuario";
  const role = effectiveRole;
  const stats = {
    pending: players.filter((p) => p.docStatus === "pending").length,
    approved: players.filter((p) => p.docStatus === "approved").length,
    rejected: players.filter((p) => p.docStatus === "rejected").length,
    paymentsDue: players.reduce((n, p) => n + p.payments.filter((x) => !x.paid).length, 0),
  };

  // Para el panel de adultos responsables: mostrar bienvenida con identificador
  const isAdultFamilyProfile = auth.role === "family" && auth.activeProfile?.kind === "adult";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-5">
        {isAdultFamilyProfile ? (
          <>
            <div className="text-xs uppercase tracking-widest text-primary">Panel de responsables</div>
            <h1 className="mt-1 text-2xl font-black">
              Bienvenidos responsables de {auth.family?.reference_code ?? "esta cuenta"}
            </h1>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-semibold">{auth.fullName}</div>
                <div className="text-xs text-muted-foreground">{auth.user?.email}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-primary">Bienvenido</div>
            <h1 className="mt-1 text-2xl font-black">{displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "admin" && "Tienes control total: finanzas, validación documental, mensajería y cartelera."}
              {role === "coach" && "Gestiona la asistencia de tus equipos y comunica con jugadores y padres."}
              {role === "player" && "Consulta tu jornada, calendario, clasificación y noticias del club."}
              {role === "senior" && "Consulta tus convocatorias, tu cuota y los chats de tus equipos."}
              {role === "staff" && "Consulta la cartelera y los chats del club."}
            </p>
            {auth.family && (
              <div className="mt-2 text-xs text-muted-foreground">
                Cuenta: <span className="font-mono font-semibold text-foreground">{auth.family.reference_code ?? "—"}</span>
                {" · "}{auth.family.children.length} hijo/a{auth.family.children.length === 1 ? "" : "s"}
              </div>
            )}
          </>
        )}
      </div>

      {role === "admin" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Jugadores" value={players.length} />
          <Stat label="Aprobados" value={stats.approved} tone="success" />
          <Stat label="Pendientes" value={stats.pending} tone="warning" />
          <Stat label="Pagos pendientes" value={stats.paymentsDue} tone="destructive" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickAction onClick={() => setView("partidos")} title="Próximos partidos" desc={`${matches.length} programados`} />
        <QuickAction onClick={() => setView("chats")} title="Chats del club" desc="Equipo, padres y difusión" />
        {role === "admin" && <QuickAction onClick={() => setView("validacion")} title="Validar documentos" desc={`${stats.pending} pendientes`} />}
        {role === "coach" && <QuickAction onClick={() => setView("asistencia")} title="Control de asistencia" desc="Entreno y partido" />}
        {(role === "parent" || role === "family") && <QuickAction onClick={() => setView("pagos")} title="Mis cuotas" desc="Estado y justificantes" />}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className={`text-3xl font-black ${toneCls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickAction({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-surface-elevated">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
