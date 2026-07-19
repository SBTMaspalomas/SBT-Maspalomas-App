import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Calendar, MapPin, Users, Trash2, Eye } from "lucide-react";

interface Convocatoria {
  id: string;
  team_id: string;
  type: "training" | "match";
  date: string;
  time: string;
  location: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  team_name?: string;
}

interface ConvocatoriaResponse {
  id: string;
  convocatoria_id: string;
  player_id: string;
  status: "confirmed" | "problem" | "pending";
  problem_type?: string;
  notes?: string;
  player_name?: string;
}

export function ConvocatoriesManager() {
  const auth = useAuth();
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [responses, setResponses] = useState<ConvocatoriaResponse[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerTeams, setPlayerTeams] = useState<Array<{ player_id: string; team_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedConvocatoria, setSelectedConvocatoria] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    team_id: "",
    type: "training" as "training" | "match",
    date: "",
    time: "",
    location: "",
    notes: "",
    selectedPlayers: [] as string[],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      { data: convData },
      { data: respData },
      { data: teamsData },
      { data: playersData },
      { data: playerTeamsData },
    ] = await Promise.all([
      supabase.from("convocatorias").select("*").order("date", { ascending: false }),
      supabase.from("convocatoria_responses").select("*"),
      supabase.from("teams").select("id, name"),
      supabase.from("players").select("id, full_name, team_id"),
      supabase.from("player_teams").select("player_id, team_id"),
    ]);

    setConvocatorias((convData || []) as Convocatoria[]);
    setResponses((respData || []) as ConvocatoriaResponse[]);
    setTeams(teamsData || []);
    setPlayers(playersData || []);
    setPlayerTeams((playerTeamsData || []) as Array<{ player_id: string; team_id: string }>);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Jugadores que pertenecen al equipo seleccionado (por player_teams o, en su
  // defecto, por el equipo principal players.team_id).
  const rosterForSelectedTeam = players.filter(
    (p) =>
      playerTeams.some((pt) => pt.player_id === p.id && pt.team_id === formData.team_id) ||
      p.team_id === formData.team_id,
  );

  const togglePlayer = (playerId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedPlayers: prev.selectedPlayers.includes(playerId)
        ? prev.selectedPlayers.filter((id) => id !== playerId)
        : [...prev.selectedPlayers, playerId],
    }));
  };

  const handleCreateConvocatoria = async () => {
    if (!formData.team_id || !formData.date || !formData.time || !formData.location) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    if (!auth.user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    const { data: created, error } = await supabase
      .from("convocatorias")
      .insert({
        team_id: formData.team_id,
        type: formData.type,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        notes: formData.notes || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error || !created) {
      toast.error(`Error al crear convocatoria: ${error?.message ?? "desconocido"}`);
      return;
    }

    // Crear una respuesta "pendiente" por cada jugador convocado.
    if (formData.selectedPlayers.length > 0) {
      const { error: respErr } = await supabase.from("convocatoria_responses").insert(
        formData.selectedPlayers.map((playerId) => ({
          convocatoria_id: created.id,
          player_id: playerId,
          status: "pending",
        })),
      );
      if (respErr) {
        toast.error(
          `Convocatoria creada, pero fallaron las convocatorias de jugadores: ${respErr.message}`,
        );
      }
    }

    toast.success("Convocatoria creada");
    setFormData({
      team_id: "",
      type: "training",
      date: "",
      time: "",
      location: "",
      notes: "",
      selectedPlayers: [],
    });
    setOpenDialog(false);
    loadData();
  };

  const handleDeleteConvocatoria = async (id: string) => {
    const { error } = await supabase.from("convocatorias").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar convocatoria");
      return;
    }
    toast.success("Convocatoria eliminada");
    loadData();
  };

  const getResponseStats = (convId: string) => {
    const convResponses = responses.filter((r) => r.convocatoria_id === convId);
    return {
      total: convResponses.length,
      confirmed: convResponses.filter((r) => r.status === "confirmed").length,
      problems: convResponses.filter((r) => r.status === "problem").length,
      pending: convResponses.filter((r) => r.status === "pending").length,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Convocatorias</h2>
          <p className="text-sm text-muted-foreground">Entrenamientos y partidos</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Convocatoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Convocatoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as "training" | "match" })
                  }
                  className="w-full rounded border border-border bg-background p-2 text-sm"
                >
                  <option value="training">Entrenamiento</option>
                  <option value="match">Partido</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Equipo</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full rounded border border-border bg-background p-2 text-sm"
                >
                  <option value="">Selecciona un equipo</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Fecha</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hora</label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Lugar</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ej: Campo municipal"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Información adicional..."
                  className="w-full rounded border border-border bg-background p-2 text-sm"
                  rows={3}
                />
              </div>

              {formData.team_id && (
                <div>
                  <label className="text-sm font-medium">Jugadores convocados</label>
                  {rosterForSelectedTeam.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Este equipo no tiene jugadores asignados todavía.
                    </p>
                  ) : (
                    <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
                      {rosterForSelectedTeam.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedPlayers.includes(p.id)}
                            onChange={() => togglePlayer(p.id)}
                          />
                          {p.full_name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleCreateConvocatoria} className="w-full">
                Crear Convocatoria
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Convocatorias List */}
      <div className="space-y-2">
        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </Card>
        ) : convocatorias.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay convocatorias</p>
          </Card>
        ) : (
          convocatorias.map((conv) => {
            const stats = getResponseStats(conv.id);
            const team = teams.find((t) => t.id === conv.team_id);
            const date = new Date(conv.date);
            const dateStr = date.toLocaleDateString("es-ES", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            return (
              <Card key={conv.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={conv.type === "match" ? "default" : "secondary"}>
                        {conv.type === "match" ? "Partido" : "Entrenamiento"}
                      </Badge>
                      <span className="text-sm font-semibold">{team?.name}</span>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {dateStr} a las {conv.time}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {conv.location}
                      </div>
                      {conv.notes && (
                        <p className="text-xs text-muted-foreground italic">{conv.notes}</p>
                      )}
                    </div>

                    {/* Response Stats */}
                    <div className="mt-3 flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {stats.total} respuestas
                      </Badge>
                      {stats.confirmed > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          ✓ {stats.confirmed}
                        </Badge>
                      )}
                      {stats.problems > 0 && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                          ⚠ {stats.problems}
                        </Badge>
                      )}
                      {stats.pending > 0 && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
                          ? {stats.pending}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedConvocatoria(conv.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteConvocatoria(conv.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
