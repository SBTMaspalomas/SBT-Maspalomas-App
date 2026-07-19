import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Users, Trophy, RefreshCw, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlayerTeamAssignment } from "@/components/club/PlayerTeamAssignment";

interface Team {
  id: string;
  name: string;
  category: string;
}

interface Player {
  id: string;
  full_name: string;
  team_id: string | null;
}

export function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: teamsData }, { data: playersData }] = await Promise.all([
      supabase.from("teams").select("id, name, category").order("name"),
      supabase.from("players").select("id, full_name, team_id"),
    ]);
    setTeams((teamsData ?? []) as Team[]);
    setPlayers((playersData ?? []) as Player[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.category.trim()) {
      toast.error("Nombre y categoría son requeridos");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("teams")
        .update({
          name: formData.name.trim(),
          category: formData.category.trim(),
        })
        .eq("id", editingId);
      if (error) {
        toast.error("Error al actualizar equipo");
        return;
      }
      toast.success("Equipo actualizado");
    } else {
      const { error } = await supabase.from("teams").insert({
        name: formData.name.trim(),
        category: formData.category.trim(),
      });
      if (error) {
        toast.error("Error al crear equipo");
        return;
      }
      toast.success("Equipo creado");
    }

    setFormData({ name: "", category: "" });
    setEditingId(null);
    setOpen(false);
    load();
  };

  const handleEdit = (team: Team) => {
    setFormData({ name: team.name, category: team.category });
    setEditingId(team.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este equipo?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar equipo");
      return;
    }
    toast.success("Equipo eliminado");
    load();
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ name: "", category: "" });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Equipos
          </h2>
          <p className="text-sm text-muted-foreground">
            {teams.length} equipo{teams.length !== 1 ? "s" : ""} registrado
            {teams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Asignar equipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Asignar equipos a jugadores</DialogTitle>
              </DialogHeader>
              <PlayerTeamAssignment onChanged={load} />
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: "", category: "" });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo equipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar equipo" : "Crear nuevo equipo"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre del equipo</label>
                  <Input
                    placeholder="Ej: Cadete A, Senior Masculino"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoría</label>
                  <Input
                    placeholder="Ej: Cadete, Junior, Senior"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>{editingId ? "Actualizar" : "Crear"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Cargando equipos...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.length === 0 ? (
            <Card className="col-span-full p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No hay equipos creados aún</p>
            </Card>
          ) : (
            teams.map((team) => {
              const teamMembers = players.filter((p) => p.team_id === team.id);
              return (
                <Card key={team.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-foreground">{team.name}</h3>
                        <p className="text-sm text-muted-foreground">{team.category}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {teamMembers.length} jugador{teamMembers.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    {teamMembers.length > 0 && (
                      <div className="text-xs space-y-1 pt-2 border-t border-border">
                        {teamMembers.slice(0, 3).map((member) => (
                          <div key={member.id} className="text-muted-foreground truncate">
                            • {member.full_name}
                          </div>
                        ))}
                        {teamMembers.length > 3 && (
                          <div className="text-muted-foreground text-[10px]">
                            +{teamMembers.length - 3} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
