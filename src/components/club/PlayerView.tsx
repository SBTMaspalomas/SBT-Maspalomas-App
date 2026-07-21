import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/clubStore";
import { useMatches } from "@/hooks/use-matches";
import { localVisitante, mapsUrl } from "@/lib/matches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, Trophy, Sparkles, Newspaper, Image as ImageIcon, BarChart3, MapPin, Clock } from "lucide-react";

interface EventRow { id: string; title: string; description: string | null; event_date: string; kind: string; }
interface StandingRow { id: string; opponent_name: string; position: number; wins: number; losses: number; points: number; }

interface Props {
  childId?: string; // when family selected a specific child
}

export function PlayerView({ childId }: Props = {}) {
  const auth = useAuth();
  const announcements = useClub((s) => s.announcements);
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teamLabel, setTeamLabel] = useState<string>("Sin equipo asignado");
  // UUID de los equipos del jugador (resuelto en resolveTeams) para filtrar partidos.
  const [teamUuids, setTeamUuids] = useState<string[]>([]);
  const { matches } = useMatches(teamUuids);

  const child = useMemo(() => {
    if (!childId || !auth.family) return null;
    return auth.family.children.find((c) => c.id === childId) ?? null;
  }, [childId, auth.family]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const teamText = child?.team_id ?? null;

      // Resolver el UUID del equipo (team_id puede ser un UUID o un nombre) para poder
      // filtrar standings.team_id (UUID) sin lanzar 22P02.
      let teamUuid: string | null = null;
      if (teamText) {
        const { data: teamsData } = await supabase.from("teams").select("id, name");
        teamUuid = (teamsData ?? []).find((x) => x.id === teamText || x.name === teamText)?.id ?? null;
      }

      const [{ data: s }, { data: ev }] = await Promise.all([
        teamUuid
          ? supabase.from("standings").select("id, opponent_name, position, wins, losses, points").eq("team_id", teamUuid).order("position", { ascending: true })
          : Promise.resolve({ data: [] as StandingRow[] }),
        supabase.from("club_events").select("id, title, description, event_date, kind").order("event_date", { ascending: true }),
      ]);
      setStandings((s ?? []) as StandingRow[]);
      setEvents((ev ?? []) as EventRow[]);
      setLoading(false);
    };
    load();
  }, [child]);

  // Resolver el/los nombre(s) de equipo del jugador (evita mostrar el UUID en la cabecera).
  useEffect(() => {
    let active = true;
    const resolveTeams = async () => {
      if (!child?.id && !child?.team_id) {
        if (active) setTeamLabel("Sin equipo asignado");
        return;
      }
      const [{ data: teams }, { data: pTeams }] = await Promise.all([
        supabase.from("teams").select("id, name, category"),
        child?.id
          ? supabase.from("player_teams").select("team_id").eq("player_id", child.id)
          : Promise.resolve({ data: [] as Array<{ team_id: string }> }),
      ]);
      const teamList = teams ?? [];
      const ids = new Set<string>();
      (pTeams ?? []).forEach((pt) => ids.add(pt.team_id));
      // Compatibilidad: players.team_id puede guardar un UUID o el nombre del equipo.
      const primary = child?.team_id ?? null;
      const names: string[] = [];
      const matchedIds: string[] = [];
      teamList.forEach((t) => {
        if (ids.has(t.id) || t.id === primary || t.name === primary) {
          names.push(`${t.name} (${t.category})`);
          matchedIds.push(t.id);
        }
      });
      const label = names.length > 0
        ? Array.from(new Set(names)).join(" · ")
        : (primary ? primary : "Sin equipo asignado");
      if (active) {
        setTeamLabel(label);
        setTeamUuids(matchedIds);
      }
    };
    resolveTeams();
    return () => { active = false; };
  }, [child]);

  // `matches` ya viene filtrado por los equipos del jugador y ordenado por fecha/hora.
  const sorted = matches;
  const next = sorted[0];

  const displayName = child?.full_name ?? auth.fullName ?? "Jugador/a";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-elevated p-5">
        <div className="text-xs uppercase tracking-widest text-primary">Perfil jugador/a</div>
        <h1 className="mt-1 text-2xl font-black">{displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Cargando…" : <>Equipo: <span className="font-semibold text-foreground">{teamLabel}</span></>}
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
              ) : (() => {
                const { local, visitante } = localVisitante(next, teamLabel);
                return (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-primary">Próxima jornada</div>
                    <div className="mt-1 text-lg font-black">{local} <span className="text-muted-foreground text-sm">vs</span> {visitante}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {new Date(next.match_date).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })}{next.match_time ? ` · ${next.match_time}` : ""}
                    </div>
                    <div className="mt-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${next.is_home ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                        {next.is_home ? "EN CASA" : "FUERA"}
                      </span>
                    </div>
                    {next.venue_address && (
                      <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        href={mapsUrl(next.venue_address)}
                        target="_blank" rel="noreferrer">
                        <MapPin className="h-3 w-3" /> {next.venue ?? next.venue_address} · abrir en Maps
                      </a>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="calendario" className="mt-4 space-y-2">
              {sorted.length === 0 && <p className="text-sm text-muted-foreground">Sin partidos en el calendario.</p>}
              {sorted.map((m) => {
                const { local, visitante } = localVisitante(m, teamLabel);
                return (
                  <div key={m.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{local} vs {visitante}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(m.match_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}{m.match_time ? ` · ${m.match_time}` : ""}
                        </div>
                        {m.venue_address ? (
                          <a
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            href={mapsUrl(m.venue_address)}
                            target="_blank" rel="noreferrer"
                          >
                            <MapPin className="h-3 w-3" /> {m.venue ?? "Ver ubicación"}
                          </a>
                        ) : m.venue ? (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {m.venue}
                          </div>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.is_home ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                        {m.is_home ? "CASA" : "FUERA"}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                      {standings.map((s) => (
                        <tr key={s.id} className="border-t border-border">
                          <td className="p-2">{s.position}</td>
                          <td className="p-2">{s.opponent_name}</td>
                          <td className="p-2 text-center">{s.wins}</td>
                          <td className="p-2 text-center">{s.losses}</td>
                          <td className="p-2 text-center text-primary">{s.points}</td>
                        </tr>
                      ))}
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
