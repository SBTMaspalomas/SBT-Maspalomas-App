import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { useAuth } from "@/lib/auth-context";
import { RegistrationFlow } from "@/components/club/RegistrationFlow";
import { ValidationConsole } from "@/components/club/ValidationConsole";
import { PaymentsAdmin, PaymentsParent } from "@/components/club/Payments";
import { Attendance } from "@/components/club/Attendance";
import { Chats } from "@/components/club/Chats";
import { Board } from "@/components/club/Board";
import { RoleManager } from "@/components/club/RoleManager";
import { PlayerView } from "@/components/club/PlayerView";
import type { Role } from "@/lib/clubStore";
import {
  LayoutDashboard, FileSignature, ShieldCheck, Wallet, ClipboardCheck, MessagesSquare, Newspaper, RefreshCw, Menu, X, LogOut, Users, Trophy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Club Hoops · Gestión del Club" },
      { name: "description", content: "Plataforma móvil de gestión integral para club de baloncesto: registros federativos, cuotas, asistencia, chats y cartelera." },
    ],
  }),
  component: ClubApp,
});

type View = "inicio" | "registro" | "validacion" | "pagos" | "asistencia" | "chats" | "cartelera" | "roles" | "mizona";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard, roles: ["admin", "coach", "parent", "player"] },
  { id: "mizona", label: "Mi zona", icon: Trophy, roles: ["player"] },
  { id: "cartelera", label: "Cartelera", icon: Newspaper, roles: ["admin", "coach", "parent"] },
  { id: "registro", label: "Registro federativo", icon: FileSignature, roles: ["admin", "parent"] },
  { id: "validacion", label: "Validación docs.", icon: ShieldCheck, roles: ["admin"] },
  { id: "pagos", label: "Cuotas y pagos", icon: Wallet, roles: ["admin", "parent"] },
  { id: "asistencia", label: "Asistencia", icon: ClipboardCheck, roles: ["coach"] },
  { id: "chats", label: "Chats", icon: MessagesSquare, roles: ["admin", "coach", "parent", "player"] },
  { id: "roles", label: "Usuarios y roles", icon: Users, roles: ["admin"] },
];

function ClubApp() {
  const auth = useAuth();
  const navigate = useNavigate();
  const user = useClub(currentUser);
  const [view, setView] = useState<View>("inicio");
  const [navOpen, setNavOpen] = useState(false);

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const displayName = auth.fullName || auth.user?.email || user.name;
  const roleLabel = auth.role === "admin" ? "Administrador" : auth.role === "coach" ? "Entrenador" : auth.role === "player" ? "Jugador/a" : "Padre / Tutor";
  const initials = displayName.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const handleSignOut = async () => {
    await auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button className="shrink-0 lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-label="menu">
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-black">
              🏀
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-wider">Club Hoops</div>
              <div className="truncate text-[11px] text-muted-foreground">Gestión integral</div>
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
          </div>

        </aside>

        {/* Main */}
        <main className="space-y-4">
          {view === "inicio" && user.role === "player" && <PlayerView />}
          {view === "inicio" && user.role !== "player" && <Home setView={setView} />}
          {view === "mizona" && <PlayerView />}
          {view === "cartelera" && <Board />}
          {view === "registro" && <RegistrationFlow />}
          {view === "validacion" && user.role === "admin" && <ValidationConsole />}
          {view === "pagos" && user.role === "admin" && <PaymentsAdmin />}
          {view === "pagos" && user.role === "parent" && <PaymentsParent />}
          {view === "asistencia" && user.role === "coach" && <Attendance />}
          {view === "chats" && <Chats />}
          {view === "roles" && user.role === "admin" && <RoleManager />}
        </main>
      </div>
    </div>
  );
}

function Home({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const user = useClub(currentUser);
  const players = useClub((s) => s.players);
  const matches = useClub((s) => s.matches);
  const displayName = auth.fullName || auth.user?.email || user.name;
  const role = auth.role ?? user.role;
  const stats = {
    pending: players.filter((p) => p.docStatus === "pending").length,
    approved: players.filter((p) => p.docStatus === "approved").length,
    rejected: players.filter((p) => p.docStatus === "rejected").length,
    paymentsDue: players.reduce((n, p) => n + p.payments.filter((x) => !x.paid).length, 0),
  };


  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-5">
        <div className="text-xs uppercase tracking-widest text-primary">Bienvenido</div>
        <h1 className="mt-1 text-2xl font-black">{displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "admin" && "Tienes control total: finanzas, validación documental, mensajería y cartelera."}
          {role === "coach" && "Gestiona la asistencia de tus equipos y comunica con jugadores y padres."}
          {role === "parent" && "Consulta tus pagos, próximos partidos y chats del equipo."}
          {role === "player" && "Consulta tu jornada, calendario, clasificación y noticias del club."}
        </p>
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
        <QuickAction onClick={() => setView("cartelera")} title="Próximos partidos" desc={`${matches.length} programados`} />
        <QuickAction onClick={() => setView("chats")} title="Chats del club" desc="Equipo, padres y difusión" />
        {user.role === "admin" && <QuickAction onClick={() => setView("validacion")} title="Validar documentos" desc={`${stats.pending} pendientes`} />}
        {user.role === "coach" && <QuickAction onClick={() => setView("asistencia")} title="Tomar asistencia" desc="Entreno y partido" />}
        {user.role === "parent" && <QuickAction onClick={() => setView("pagos")} title="Mis cuotas" desc="Estado y justificantes" />}
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
