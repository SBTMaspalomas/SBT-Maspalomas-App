import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PlayerRow {
  id: string;
  full_name: string;
  team_id: string | null;
  family_id: string | null;
  birth_date: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  category: string;
}

export function PlayerTeamAssignment() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("players").select("id, full_name, team_id, family_id, birth_date").order("full_name"),
      supabase.from("teams").select("id, name, category").order("name"),
    ]);
    if (p) setPlayers(p);
    if (t) setTeams(t);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleAssignTeam = async (playerId: string, teamId: string) => {
    const { error } = await supabase.from("players").update({ team_id: teamId }).eq("id", playerId);
    if (error) {
      toast.error("Error al asignar equipo");
      return;
    }
    toast.success("Equipo asignado correctamente");
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, team_id: teamId } : p));
    setOpen(false);
  };

  const handleRemoveTeam = async (playerId: string) => {
    const { error } = await supabase.from("players").update({ team_id: null }).eq("id", playerId);
    if (error) {
      toast.error("Error al remover equipo");
      return;
    }
    toast.success("Equipo removido");
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, team_id: null } : p));
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando jugadores...</div>;
  }

  const unassigned = players.filter((p) => !p.team_id).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Asignación de Equipos</h2>
          <p className="text-sm text-muted-foreground">Vincular jugadores con equipos</p>
        </div>
      </div>

      {unassigned > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning">Jugadores sin equipo oficial</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {unassigned} jugador{unassigned !== 1 ? "es" : ""} necesita asignación
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
            const team = teams.find((t) => t.id === player.team_id);
            return (
              <Card key={player.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{player.full_name}</h3>
                    {player.birth_date && (
                      <p className="text-xs text-muted-foreground">Nac: {new Date(player.birth_date).toLocaleDateString("es-ES")}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Equipo Oficial</p>
                      {team ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/15 text-primary border-primary/30">
                            <Trophy className="h-3 w-3 mr-1" />
                            {team.name} ({team.category})
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
                      <div className="space-y-2">
                        {teams.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay equipos creados</p>
                        ) : (
                          teams.map((t) => (
                            <Button
                              key={t.id}
                              variant={t.id === player.team_id ? "default" : "outline"}
                              className="w-full justify-start"
                              onClick={() => handleAssignTeam(player.id, t.id)}
                            >
                              <Trophy className="h-4 w-4 mr-2" />
                              {t.name} ({t.category})
                              {t.id === player.team_id && " ✓"}
                            </Button>
                          ))
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

