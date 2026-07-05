import { useMemo, useState } from "react";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AttendanceStatus = "present" | "late" | "absent";
type AbsenceReason = "justified" | "unjustified";

export function Attendance() {
  const user = useClub(currentUser);
  const teams = useClub((s) => s.teams);
  const players = useClub((s) => s.players);
  
  const myTeams = teams.filter((t) => user.teamIds?.includes(t.id));
  const [teamId, setTeamId] = useState(myTeams[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  
  const teamPlayers = players.filter((p) => p.teamId === teamId);

  const setAttendanceStatus = (playerId: string, status: AttendanceStatus) => {
    clubStore.set((s) => {
      const player = s.players.find((p) => p.id === playerId);
      if (!player) return;
      
      const currentDay = player.attendance?.[date] ?? {};
      const nextDay = {
        ...currentDay,
        status,
        training: status === "present" || status === "late",
        match: false,
        absentReason: status === "absent" 
          ? (currentDay.absentReason as AbsenceReason | undefined) ?? "unjustified"
          : undefined,
      };
      
      if (!player.attendance) player.attendance = {};
      player.attendance[date] = nextDay;
    });
  };

  const setAbsenceReason = (playerId: string, reason: AbsenceReason) => {
    clubStore.set((s) => {
      const player = s.players.find((p) => p.id === playerId);
      if (!player) return;
      
      const currentDay = player.attendance?.[date] ?? {};
      if (!player.attendance) player.attendance = {};
      player.attendance[date] = {
        ...currentDay,
        status: "absent",
        training: false,
        match: false,
        absentReason: reason,
      };
    });
  };

  const monthlyLateStats = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return teamPlayers
      .map((player) => {
        const entries = Object.entries(player.attendance ?? {}).filter(([day]) =>
          day.startsWith(monthPrefix)
        );
        
        const lateCount = entries.filter(([, value]: [string, any]) => value?.status === "late").length;
        const presentCount = entries.filter(([, value]: [string, any]) => value?.status === "present").length;
        const absentCount = entries.filter(([, value]: [string, any]) => value?.status === "absent").length;
        
        return {
          id: player.id,
          name: `${player.firstName} ${player.lastName}`,
          lateCount,
          presentCount,
          absentCount,
        };
      })
      .sort((a, b) => b.lateCount - a.lateCount || a.name.localeCompare(b.name));
  }, [teamPlayers]);

  if (myTeams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No tienes equipos asignados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">Asistencia</CardTitle>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecciona equipo" />
              </SelectTrigger>
              <SelectContent>
                {myTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha seleccionada
              </p>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {date !== today && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Editando una fecha anterior
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {teamPlayers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No hay jugadores en este equipo.
              </div>
            ) : (
              teamPlayers.map((player) => {
                const day = player.attendance?.[date] ?? {};
                const status = (day.status as AttendanceStatus | undefined) ?? null;
                const absentReason = (day.absentReason as AbsenceReason | undefined) ?? "unjustified";
                
                return (
                  <div key={player.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="mb-3">
                      <div className="text-sm font-semibold text-foreground">
                        {player.firstName} {player.lastName}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus(player.id, "present")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "present"
                            ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                        ].join(" ")}
                      >
                        Presente
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus(player.id, "late")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "late"
                            ? "border-amber-700 bg-amber-500 text-white shadow-sm"
                            : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                        ].join(" ")}
                      >
                        <span className="mr-2 text-base">⏱️</span>
                        Retraso
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setAttendanceStatus(player.id, "absent")}
                        className={[
                          "flex h-14 items-center justify-center rounded-xl border text-sm font-semibold transition",
                          status === "absent"
                            ? "border-red-700 bg-red-600 text-white shadow-sm"
                            : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                        ].join(" ")}
                      >
                        Ausente
                      </button>
                    </div>

                    {status === "absent" && (
                      <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Motivo de la falta
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAbsenceReason(player.id, "justified")}
                            className={[
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              absentReason === "justified"
                                ? "border-sky-700 bg-sky-600 text-white"
                                : "border-border bg-background text-foreground hover:bg-muted",
                            ].join(" ")}
                          >
                            Justificada
                          </button>
                          <button
                            type="button"
                            onClick={() => setAbsenceReason(player.id, "unjustified")}
                            className={[
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              absentReason === "unjustified"
                                ? "border-slate-800 bg-slate-700 text-white"
                                : "border-border bg-background text-foreground hover:bg-muted",
                            ].join(" ")}
                          >
                            Injustificada
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
