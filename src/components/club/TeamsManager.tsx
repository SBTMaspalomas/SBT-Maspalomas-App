import { useClub } from "@/lib/clubStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Edit2, Trash2, Users, Trophy } from "lucide-react";
import { toast } from "sonner";

export function TeamsManager() {
  const teams = useClub((s) => s.teams);
  const players = useClub((s) => s.players);
  const addTeam = useClub((s) => s.addTeam);
  const removeTeam = useClub((s) => s.removeTeam);
  const updateTeam = useClub((s) => s.updateTeam);
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "", coach: "" });

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.category.trim()) {
      toast.error("Nombre y categoría son requeridos");
      return;
    }

    if (editingId) {
      updateTeam(editingId, { name: formData.name, category: formData.category, coach: formData.coach });
      toast.success("Equipo actualizado");
    } else {
      addTeam({ name: formData.name, category: formData.category, coach: formData.coach });
      toast.success("Equipo creado");
    }

    setFormData({ name: "", category: "", coach: "" });
    setEditingId(null);
    setOpen(false);
  };

  const handleEdit = (team: any) => {
    setFormData({ name: team.name, category: team.category, coach: team.coach || "" });
    setEditingId(team.id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este equipo?")) {
      removeTeam(id);
      toast.success("Equipo eliminado");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ name: "", category: "", coach: "" });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Gestión de Equipos</h2>
          <p className="text-sm text-muted-foreground">{teams.length} equipo{teams.length !== 1 ? "s" : ""} registrado{teams.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setFormData({ name: "", category: "", coach: "" }); }}>
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
                  placeholder="Ej: Baloncesto U16"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <Input
                  placeholder="Ej: U16, U18, Senior"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Entrenador</label>
                <Input
                  placeholder="Nombre del entrenador"
                  value={formData.coach}
                  onChange={(e) => setFormData({ ...formData, coach: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams Grid */}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(team)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(team.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {team.coach && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Entrenador:</span> {team.coach}
                    </div>
                  )}

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
    </div>
  );
}
