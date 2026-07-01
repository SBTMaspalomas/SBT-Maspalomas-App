import { useMemo, useState } from "react";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function Attendance() {
  const user = useClub(currentUser);
  const teams = useClub((s) => s.teams);
  const players = useClub((s) => s.players);
  const myTeams = teams.filter((t) => user.teamIds?.includes(t.id));
  const [teamId, setTeamId] = useState(myTeams[0]?.id ?? "");
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const teamPlayers = players.filter((p) => p.teamId === teamId);

  const toggle = (pid: string, key: "training" | "match") => {
    clubStore.set((s) => {
      const p = s.players.find((x) => x.id === pid);
      if (!p) return;
      const day = p.attendance[date] ?? { training: false, match: false };
      day[key] = !day[key];
      p.attendance[date] = day;
    });
  };

  const stats = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return teamPlayers.map((p) => {
      const entries = Object.entries(p.attendance).filter(([d]) => d.startsWith(monthPrefix));
      const total = entries.length || 1;
      const present = entries.filter(([, v]) => v.training).length;
      return { id: p.id, name: `${p.firstName} ${p.lastName}`, pct: Math.round((present / total) * 100) };
    });
  }, [teamPlayers]);

  if (myTeams.length === 0) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No tienes equipos asignados.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="whitespace-pre-line leading-tight">
              Asistencia{"\n"}
              {date}
            </span>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border pb-2 text-xs font-semibold uppercase text-muted-foreground">
            <div>Jugador</div><div className="w-16 text-center">Entreno</div><div className="w-16 text-center">Partido</div>
          </div>
          {teamPlayers.map((p) => {
            const day = p.attendance[date] ?? { training: false, match: false };
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border/50 py-2.5">
                <div className="min-w-0 truncate text-sm">{p.firstName} {p.lastName}</div>
                <div className="flex w-16 justify-center"><Checkbox checked={day.training} onCheckedChange={() => toggle(p.id, "training")} /></div>
                <div className="flex w-16 justify-center"><Checkbox checked={day.match} onCheckedChange={() => toggle(p.id, "match")} /></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estadísticas internas · Asistencia mensual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {stats.map((s) => (
            <div key={s.id}>
              <div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="font-mono">{s.pct}%</span></div>
              <Progress value={s.pct} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
