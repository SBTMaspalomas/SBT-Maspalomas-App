import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PlayerRow {
  id: string;
  full_name: string;
  team_id: string | null;
  family_id: string | null;
  birth_date: string | null;
  user_id: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  category: string;
}

interface PlayerTeamRow {
  player_id: string;
  team_id: string;
  dorsal: number | null;
}

export function PlayerTeamAssignment({ onChanged }: { onChanged?: () => void } = {}) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [playerTeams, setPlayerTeams] = useState<PlayerTeamRow[]>([]);
  const [refCodes, setRefCodes] = useState<Record<string, string>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: p }, { data: t }, { data: pt }, { data: fams }] = await Promise.all([
      supabase
        .from("players")
        .select("id, full_name, team_id, family_id, birth_date, user_id")
        .order("full_name"),
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("player_teams").select("player_id, team_id, dorsal"),
      supabase.from("families_meta").select("id, reference_code"),
    ]);
    if (p) setPlayers(p as PlayerRow[]);
    if (t) setTeams(t as TeamRow[]);
    setPlayerTeams((pt ?? []) as PlayerTeamRow[]);
    const codes: Record<string, string> = {};
    (fams ?? []).forEach((f: any) => {
      if (f.reference_code) codes[f.id] = f.reference_code;
    });
    setRefCodes(codes);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Equipos actualmente asignados a un jugador (join player_teams + compatibilidad
  // con el "equipo principal" heredado en players.team_id, que puede ser UUID o nombre).
  const teamsForPlayer = (player: PlayerRow): TeamRow[] => {
    const ids = new Set(
      playerTeams.filter((pt) => pt.player_id === player.id).map((pt) => pt.team_id),
    );
    const result = teams.filter(
      (t) => ids.has(t.id) || t.id === player.team_id || t.name === player.team_id,
    );
    // Deduplicar por id
    return Array.from(new Map(result.map((t) => [t.id, t])).values());
  };

  const isAssigned = (player: PlayerRow, teamId: string): boolean =>
    playerTeams.some((pt) => pt.player_id === player.id && pt.team_id === teamId) ||
    player.team_id === teamId;

  // Dorsal asignado a un jugador en un equipo concreto (null si no tiene).
  const dorsalFor = (playerId: string, teamId: string): number | null =>
    playerTeams.find((pt) => pt.player_id === playerId && pt.team_id === teamId)?.dorsal ?? null;

  // Identificador visible del jugador: código de cuenta de familia o, para un
  // jugador adulto (SENIOR, sin familia), su nombre.
  const identifierFor = (player: PlayerRow): string => {
    if (player.family_id && refCodes[player.family_id]) return refCodes[player.family_id];
    if (player.user_id) return "Senior";
    return "—";
  };

  const toggleTeam = async (player: PlayerRow, teamId: string) => {
    setSavingTeam(teamId);
    const assigned = isAssigned(player, teamId);
    try {
      if (assigned) {
        const { error } = await supabase
          .from("player_teams")
          .delete()
          .eq("player_id", player.id)
          .eq("team_id", teamId);
        if (error) throw error;
        // Si era el equipo principal, recalcular con el primero restante.
        if (player.team_id === teamId) {
          const remaining = playerTeams.filter(
            (pt) => pt.player_id === player.id && pt.team_id !== teamId,
          );
          const newPrimary = remaining[0]?.team_id ?? null;
          await supabase.from("players").update({ team_id: newPrimary }).eq("id", player.id);
        }
      } else {
        const { error } = await supabase
          .from("player_teams")
          .insert({ player_id: player.id, team_id: teamId });
        if (error) throw error;
        // Si no tenía equipo principal, este pasa a serlo.
        const hasPrimary = teams.some((t) => t.id === player.team_id);
        if (!hasPrimary) {
          await supabase.from("players").update({ team_id: teamId }).eq("id", player.id);
        }
      }
      await loadData();
      onChanged?.();
    } catch (err: any) {
      toast.error(`Error al actualizar equipos: ${err.message}`);
    } finally {
      setSavingTeam(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Cargando jugadores...</div>
    );
  }

  const unassigned = players.filter((p) => teamsForPlayer(p).length === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Asignación de Equipos</h2>
          <p className="text-sm text-muted-foreground">
            Un jugador puede pertenecer a varios equipos
          </p>
        </div>
      </div>

      {unassigned > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning">Jugadores sin equipo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {unassigned} jugador{unassigned !== 1 ? "es" : ""} sin asignar
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {players.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay jugadores registrados</p>
          </Card>
        ) : (
          players.map((player) => {
            const assignedTeams = teamsForPlayer(player);
            return (
              <Card key={player.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{player.full_name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        {identifierFor(player)}
                      </Badge>
                    </div>
                    {player.birth_date && (
                      <p className="text-xs text-muted-foreground">
                        Nac: {new Date(player.birth_date).toLocaleDateString("es-ES")}
                      </p>
                    )}
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Equipos</p>
                      {assignedTeams.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {assignedTeams.map((team) => {
                            const dorsal = dorsalFor(player.id, team.id);
                            return (
                              <Badge
                                key={team.id}
                                className="bg-primary/15 text-primary border-primary/30"
                              >
                                <Trophy className="h-3 w-3 mr-1" />
                                {team.name} ({team.category})
                                {dorsal != null && <span className="ml-1 font-mono font-bold">#{dorsal}</span>}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin asignar</p>
                      )}
                    </div>
                  </div>

                  <Dialog
                    open={open && selectedPlayer === player.id}
                    onOpenChange={(isOpen) => {
                      if (isOpen) setSelectedPlayer(player.id);
                      setOpen(isOpen);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPlayer(player.id)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Asignar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Equipos de {player.full_name}</DialogTitle>
                      </DialogHeader>
                      <p className="text-xs text-muted-foreground">
                        Marca uno o varios equipos. Los cambios se guardan al instante.
                      </p>
                      <div className="space-y-2">
                        {teams.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay equipos creados</p>
                        ) : (
                          teams.map((t) => {
                            const on = isAssigned(player, t.id);
                            return (
                              <Button
                                key={t.id}
                                variant={on ? "default" : "outline"}
                                className="w-full justify-start"
                                disabled={savingTeam === t.id}
                                onClick={() => toggleTeam(player, t.id)}
                              >
                                <Trophy className="h-4 w-4 mr-2" />
                                {t.name} ({t.category}){on && " ✓"}
                              </Button>
                            );
                          })
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
