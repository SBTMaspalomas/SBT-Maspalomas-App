import { useClub } from "@/lib/clubStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Edit2, Users, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function PlayerTeamAssignment() {
  const players = useClub((s) => s.players);
  const teams = useClub((s) => s.teams);
  const updatePlayer = useClub((s) => s.updatePlayer);
  
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleAssignTeam = (playerId: string, teamId: string, isOfficial: boolean) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    if (isOfficial) {
      updatePlayer(playerId, { team_id: teamId });
      toast.success("Equipo oficial asignado");
    } else {
      // Para equipos secundarios, se usaría una tabla separada en el futuro
      toast.info("Equipos secundarios: funcionalidad próxima");
    }
  };

  const handleRemoveTeam = (playerId: string) => {
    updatePlayer(playerId, { team_id: null });
    toast.success("Equipo oficial removido");
  };

  const player = selectedPlayer ? players.find((p) => p.id === selectedPlayer) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Asignación de Equipos</h2>
          <p className="text-sm text-muted-foreground">Vincular jugadores con equipos</p>
        </div>
      </div>

      {/* Players without team */}
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-warning">Jugadores sin equipo oficial</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {players.filter((p) => !p.team_id).length} jugador{players.filter((p) => !p.team_id).length !== 1 ? "es" : ""} necesita asignación
            </p>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="space-y-2">
        {players.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay jugadores registrados</p>
          </Card>
        ) : (
          players.map((player) => {
            const team = teams.find((t) => t.id === player.team_id);
            return (
              <Card key={player.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{player.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{player.email}</p>
                    
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Equipo Oficial</p>
                        {team ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/15 text-primary border-primary/30">
                              <Trophy className="h-3 w-3 mr-1" />
                              {team.name}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTeam(player.id)}
                              className="text-xs h-6"
                            >
                              Remover
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sin asignar</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Dialog open={open && selectedPlayer === player.id} onOpenChange={(isOpen) => {
                    if (isOpen) setSelectedPlayer(player.id);
                    setOpen(isOpen);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedPlayer(player.id)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Asignar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Asignar Equipo a {player.full_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-sm mb-3">Equipo Oficial</h3>
                          <div className="space-y-2">
                            {teams.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No hay equipos creados</p>
                            ) : (
                              teams.map((team) => (
                                <Button
                                  key={team.id}
                                  variant={team.id === player.team_id ? "default" : "outline"}
                                  className="w-full justify-start"
                                  onClick={() => {
                                    handleAssignTeam(player.id, team.id, true);
                                    setOpen(false);
                                  }}
                                >
                                  <Trophy className="h-4 w-4 mr-2" />
                                  {team.name}
                                  {team.id === player.team_id && " ✓"}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-sm mb-2 text-muted-foreground">
                            Equipos Secundarios
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Funcionalidad próxima: permitirá asignar múltiples equipos para convocatorias
                          </p>
                        </div>
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
