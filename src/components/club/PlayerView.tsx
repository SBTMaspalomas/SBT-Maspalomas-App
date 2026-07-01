import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/clubStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, Trophy, Sparkles, Newspaper, Image as ImageIcon, BarChart3, MapPin, Clock } from "lucide-react";

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  team_id: string | null;
}
interface TeamRow { id: string; name: string; category: string; }
interface StandingRow { id: string; opponent_name: string; position: number; wins: number; losses: number; points: number; }
interface EventRow { id: string; title: string; description: string | null; event_date: string; kind: string; }

export function PlayerView() {
  const auth = useAuth();
  const matches = useClub((s) => s.matches);
  const announcements = useClub((s) => s.announcements);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!auth.user) return;
      setLoading(true);
      const { data: pRows } = await supabase
        .from("players")
        .select("id, first_name, last_name, team_id")
        .eq("user_id", auth.user.id)
        .limit(1);
      const p = (pRows ?? [])[0] ?? null;
      setPlayer(p);
      if (p?.team_id) {
        const [{ data: t }, { data: s }] = await Promise.all([
          supabase.from("teams").select("id, name, category").eq("id", p.team_id).maybeSingle(),
          supabase.from("standings").select("id, opponent_name, position, wins, losses, points")
            .eq("team_id", p.team_id).order("position", { ascending: true }),
        ]);
        setTeam(t);
        setStandings(s ?? []);
      }
      const { data: ev } = await supabase.from("club_events")
        .select("id, title, description, event_date, kind").order("event_date", { ascending: true });
      setEvents(ev ?? []);
      setLoading(false);
    };
    load();
  }, [auth.user]);

  // Filter demo matches by team if we can loosely map by name (Mini A / Cadete B share ids "t1"/"t2" in demo)
  const teamMatches = team
    ? matches.filter((m) => {
        if (team.name === "Mini A") return m.teamId === "t1";
        if (team.name === "Cadete B") return m.teamId === "t2";
        return true;
      })
    : matches;

  const next = [...teamMatches].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const week = [...teamMatches].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-5">
        <div className="text-xs uppercase tracking-widest text-primary">Mi zona</div>
        <h1 className="mt-1 text-2xl font-black">
          {player ? `${player.first_name} ${player.last_name}` : (auth.fullName || "Jugador/a")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? "Cargando tu equipo…"
            : team
              ? <>Equipo: <span className="font-semibold text-foreground">{team.name}</span> · {team.category}</>
              : "Aún no estás vinculado a un jugador. Pide al club que enlace tu cuenta."}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Mi equipo</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="jornada">
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="jornada" className="flex-1"><Calendar className="mr-1 h-3.5 w-3.5" />Jornada</TabsTrigger>
              <TabsTrigger value="calendario" className="flex-1">Calendario</TabsTrigger>
              <TabsTrigger value="clasif" className="flex-1"><Trophy className="mr-1 h-3.5 w-3.5" />Clasificación</TabsTrigger>
              <TabsTrigger value="eventos" className="flex-1"><Sparkles className="mr-1 h-3.5 w-3.5" />Eventos</TabsTrigger>
              <TabsTrigger value="tablon" className="flex-1"><Newspaper className="mr-1 h-3.5 w-3.5" />Tablón</TabsTrigger>
              <TabsTrigger value="galeria" className="flex-1"><ImageIcon className="mr-1 h-3.5 w-3.5" />Galería</TabsTrigger>
              <TabsTrigger value="stats" className="flex-1"><BarChart3 className="mr-1 h-3.5 w-3.5" />Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="jornada" className="mt-4">
              {!next ? (
                <p className="text-sm text-muted-foreground">No hay próxima jornada programada.</p>
              ) : (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-primary">Próxima jornada</div>
                  <div className="mt-1 text-lg font-black">{team?.name ?? "Tu equipo"} <span className="text-muted-foreground text-sm">vs</span> {next.opponent}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {new Date(next.date).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })} · {next.time}
                  </div>
                  <div className="mt-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${next.venue === "home" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                      {next.venue === "home" ? "EN CASA" : "FUERA"}
                    </span>
                  </div>
                  {next.venue === "away" && next.address && (
                    <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`}
                      target="_blank" rel="noreferrer">
                      <MapPin className="h-3 w-3" /> {next.address} · abrir en Maps
                    </a>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendario" className="mt-4 space-y-2">
              {week.length === 0 && <p className="text-sm text-muted-foreground">Sin partidos en el calendario.</p>}
              {week.map((m) => (
                <div key={m.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{team?.name ?? "Tu equipo"} vs {m.opponent}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(m.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {m.time}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.venue === "home" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                      {m.venue === "home" ? "CASA" : "FUERA"}
                    </span>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="clasif" className="mt-4">
              {standings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay clasificación disponible.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-elevated text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Equipo</th>
                        <th className="p-2 text-center">G</th>
                        <th className="p-2 text-center">P</th>
                        <th className="p-2 text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s) => {
                        const isMine = team && s.opponent_name === team.name;
                        return (
                          <tr key={s.id} className={`border-t border-border ${isMine ? "bg-primary/10 font-semibold" : ""}`}>
                            <td className="p-2">{s.position}</td>
                            <td className="p-2">{s.opponent_name}{isMine && " ⭐"}</td>
                            <td className="p-2 text-center">{s.wins}</td>
                            <td className="p-2 text-center">{s.losses}</td>
                            <td className="p-2 text-center text-primary">{s.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="eventos" className="mt-4 space-y-2">
              {events.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos programados.</p>}
              {events.map((e) => (
                <div key={e.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{e.kind}</span>
                    <span className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="mt-1 font-semibold">{e.title}</div>
                  {e.description && <div className="mt-0.5 text-sm text-muted-foreground">{e.description}</div>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="tablon" className="mt-4 space-y-2">
              {announcements.length === 0 && <p className="text-sm text-muted-foreground">Sin anuncios.</p>}
              {announcements.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString("es-ES")}</div>
                  {a.body && <div className="mt-1.5 text-sm">{a.body}</div>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="galeria" className="mt-4">
              <ComingSoon icon={<ImageIcon className="h-8 w-8" />} label="Galería Multimedia" />
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <ComingSoon icon={<BarChart3 className="h-8 w-8" />} label="Estadísticas" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ComingSoon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div className="font-semibold">{label}</div>
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">Próximamente</span>
      <p className="max-w-xs text-xs text-muted-foreground">Este apartado se activará en próximas fases del desarrollo.</p>
    </div>
  );
}
