import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Calendar, MapPin, Users, Trash2, CheckCircle, AlertCircle, Clock, UserPlus, X } from "lucide-react";

interface Convocatoria {
  id: string;
  team_id: string | null;
  type: "training" | "match";
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  min_players: number | null;
  created_by: string | null;
  created_at: string;
}

interface ConvocatoriaResponse {
  id: string;
  convocatoria_id: string;
  player_id: string;
  status: "confirmed" | "problem" | "pending";
  problem_type?: string | null;
  notes?: string | null;
}

interface TeamRow { id: string; name: string; category: string }
interface PlayerRow { id: string; full_name: string; team_id: string | null }
interface PlayerTeamRow { player_id: string; team_id: string }
interface ExtraPlayerRow { id: string; convocatoria_id: string; player_id: string }

const keyOf = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export function ConvocatoriesManager() {
  const { user } = useAuth();
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [responses, setResponses] = useState<ConvocatoriaResponse[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playerTeams, setPlayerTeams] = useState<PlayerTeamRow[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<ExtraPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    team_id: "",
    type: "training" as "training" | "match",
    date: "",
    time: "",
    location: "",
    notes: "",
    min_players: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      { data: convData },
      { data: respData },
      { data: teamsData },
      { data: playersData },
      { data: playerTeamsData },
      { data: extraData },
    ] = await Promise.all([
      supabase.from("convocatorias").select("*").order("date", { ascending: false }),
      supabase.from("convocatoria_responses").select("*"),
      supabase.from("teams").select("id, name, category"),
      supabase.from("players").select("id, full_name, team_id"),
      supabase.from("player_teams").select("player_id, team_id"),
      supabase.from("convocatoria_extra_players").select("id, convocatoria_id, player_id"),
    ]);

    setConvocatorias((convData || []) as Convocatoria[]);
    setResponses((respData || []) as ConvocatoriaResponse[]);
    setTeams((teamsData || []) as TeamRow[]);
    setPlayers((playersData || []) as PlayerRow[]);
    setPlayerTeams((playerTeamsData || []) as PlayerTeamRow[]);
    setExtraPlayers((extraData || []) as ExtraPlayerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresco en vivo de respuestas y "doblados" mientras se ve el detalle.
  useEffect(() => {
    if (!detailId) return;
    const channel = supabase
      .channel(`convocatoria-${detailId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "convocatoria_responses", filter: `convocatoria_id=eq.${detailId}` },
        () => { loadData(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "convocatoria_extra_players", filter: `convocatoria_id=eq.${detailId}` },
        () => { loadData(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [detailId, loadData]);

  const handleCreateConvocatoria = async () => {
    if (!formData.team_id || !formData.date || !formData.time || !formData.location) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    const min = formData.min_players.trim() === "" ? null : Number(formData.min_players);
    if (min !== null && (!Number.isInteger(min) || min < 0)) {
      toast.error("El mínimo de jugadores debe ser un número válido");
      return;
    }

    const { error } = await supabase.from("convocatorias").insert({
      team_id: formData.team_id,
      type: formData.type,
      date: formData.date,
      time: formData.time,
      location: formData.location,
      notes: formData.notes || null,
      min_players: min,
      created_by: user.id,
    });

    if (error) {
      // Mostramos el motivo real (RLS, columna inexistente, restricción…) en
      // lugar de un genérico, para que el error sea diagnosticable de un vistazo.
      console.error("Error al crear convocatoria", error);
      toast.error(`Error al crear convocatoria: ${error.message}`);
      return;
    }

    toast.success("Convocatoria creada");
    setFormData({ team_id: "", type: "training", date: "", time: "", location: "", notes: "", min_players: "" });
    setOpenDialog(false);
    loadData();
  };

  const handleDeleteConvocatoria = async (id: string) => {
    const { error } = await supabase.from("convocatorias").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar convocatoria", error);
      toast.error(`Error al eliminar convocatoria: ${error.message}`);
      return;
    }
    toast.success("Convocatoria eliminada");
    loadData();
  };

  // Jugadores base de una convocatoria: los del equipo (por players.team_id o
  // por player_teams). No incluye a los "doblados".
  const basePlayerIds = useCallback((conv: Convocatoria): Set<string> => {
    const convTeam = teams.find((t) => t.id === conv.team_id);
    const teamKeys = new Set([keyOf(conv.team_id), keyOf(convTeam?.name), keyOf(convTeam?.category)]);
    const ids = new Set<string>();
    players.forEach((p) => {
      if (p.team_id && teamKeys.has(keyOf(p.team_id))) ids.add(p.id);
    });
    playerTeams.forEach((pt) => { if (pt.team_id === conv.team_id) ids.add(pt.player_id); });
    return ids;
  }, [teams, players, playerTeams]);

  const statusOf = useCallback((convId: string, playerId: string): "confirmed" | "problem" | "pending" => {
    return responses.find((r) => r.convocatoria_id === convId && r.player_id === playerId)?.status ?? "pending";
  }, [responses]);

  // Roster completo (base ∪ doblados) con su estado de respuesta.
  const rosterFor = useCallback((conv: Convocatoria) => {
    const ids = basePlayerIds(conv);
    const extras = extraPlayers.filter((e) => e.convocatoria_id === conv.id).map((e) => e.player_id);
    extras.forEach((id) => ids.add(id));
    const extraSet = new Set(extras);
    return players
      .filter((p) => ids.has(p.id))
      .map((p) => ({ ...p, status: statusOf(conv.id, p.id), isExtra: extraSet.has(p.id) }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [basePlayerIds, extraPlayers, players, statusOf]);

  const confirmedCount = useCallback((conv: Convocatoria) =>
    rosterFor(conv).filter((p) => p.status === "confirmed").length, [rosterFor]);

  const detailConv = useMemo(
    () => convocatorias.find((c) => c.id === detailId) ?? null,
    [convocatorias, detailId],
  );

  const addExtra = async (conv: Convocatoria, playerId: string) => {
    if (!user) return;
    const { error } = await supabase.from("convocatoria_extra_players").insert({
      convocatoria_id: conv.id,
      player_id: playerId,
      created_by: user.id,
    });
    if (error) { console.error("No se pudo doblar al jugador", error); toast.error(`No se pudo doblar al jugador: ${error.message}`); return; }
    toast.success("Jugador doblado");
    loadData();
  };

  const removeExtra = async (conv: Convocatoria, playerId: string) => {
    const { error } = await supabase
      .from("convocatoria_extra_players")
      .delete()
      .eq("convocatoria_id", conv.id)
      .eq("player_id", playerId);
    if (error) { console.error("No se pudo quitar al jugador", error); toast.error(`No se pudo quitar al jugador: ${error.message}`); return; }
    loadData();
  };

  const statusBadge = (status: "confirmed" | "problem" | "pending") => {
    if (status === "confirmed") return <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Confirmado</span>;
    if (status === "problem") return <span className="inline-flex items-center gap-1 text-yellow-600"><AlertCircle className="h-4 w-4" /> Problema</span>;
    return <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" /> Pendiente</span>;
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
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "training" | "match" })}
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
                    <option key={t.id} value={t.id}>{t.name}</option>
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
                <label className="text-sm font-medium">Mínimo de jugadores (acta)</label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={formData.min_players}
                  onChange={(e) => setFormData({ ...formData, min_players: e.target.value })}
                  placeholder="Ej: 8 (opcional)"
                />
                <p className="mt-1 text-xs text-muted-foreground">Si los confirmados no llegan, el contador se muestra en rojo.</p>
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
            const team = teams.find((t) => t.id === conv.team_id);
            const roster = rosterFor(conv);
            const confirmed = roster.filter((p) => p.status === "confirmed").length;
            const problems = roster.filter((p) => p.status === "problem").length;
            const pending = roster.filter((p) => p.status === "pending").length;
            const min = conv.min_players;
            const belowMin = min != null && confirmed < min;
            const date = new Date(conv.date);
            const dateStr = date.toLocaleDateString("es-ES", { weekday: "short", month: "short", day: "numeric" });

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

                    {/* Stats + contador de mínimo */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {roster.length} convocados
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${belowMin ? "bg-red-500/10 text-red-600 border-red-500/40 font-semibold" : "bg-green-50 text-green-700"}`}
                      >
                        ✓ {confirmed}{min != null ? ` / ${min}` : ""} confirmados
                      </Badge>
                      {problems > 0 && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">⚠ {problems}</Badge>
                      )}
                      {pending > 0 && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">? {pending}</Badge>
                      )}
                      {belowMin && (
                        <span className="text-xs font-medium text-red-600">No se alcanza el mínimo federativo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailId(conv.id)}>
                      Ver detalle
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

      {/* Detalle de convocatoria: roster, contador y doblar */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailConv && (() => {
            const roster = rosterFor(detailConv);
            const confirmed = confirmedCount(detailConv);
            const min = detailConv.min_players;
            const belowMin = min != null && confirmed < min;
            const baseIds = basePlayerIds(detailConv);
            const extraIds = new Set(extraPlayers.filter((e) => e.convocatoria_id === detailConv.id).map((e) => e.player_id));
            // Candidatos a doblar: jugadores que no son del equipo y no están ya doblados.
            const doblarCandidates = players
              .filter((p) => !baseIds.has(p.id) && !extraIds.has(p.id))
              .sort((a, b) => a.full_name.localeCompare(b.full_name));
            const team = teams.find((t) => t.id === detailConv.team_id);

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {detailConv.type === "match" ? "Partido" : "Entrenamiento"} · {team?.name ?? "—"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" /> {roster.length} convocados
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-sm ${belowMin ? "bg-red-500/10 text-red-600 border-red-500/40 font-bold" : "bg-green-50 text-green-700 font-semibold"}`}
                    >
                      {confirmed}{min != null ? ` / ${min}` : ""} confirmados
                    </Badge>
                    {belowMin && <span className="text-xs font-medium text-red-600">Mínimo federativo no alcanzado</span>}
                  </div>

                  {/* Roster */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Convocados</h3>
                    {roster.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin jugadores en el equipo.</p>
                    ) : (
                      roster.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-sm">{p.full_name}</span>
                            {p.isExtra && <Badge variant="outline" className="text-[10px]">Doblado</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{statusBadge(p.status)}</span>
                            {p.isExtra && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeExtra(detailConv, p.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Doblar */}
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-1 text-sm font-semibold">
                      <UserPlus className="h-4 w-4" /> Doblar jugador de otra categoría
                    </h3>
                    <select
                      className="w-full rounded border border-border bg-background p-2 text-sm"
                      value=""
                      onChange={(e) => { if (e.target.value) addExtra(detailConv, e.target.value); }}
                    >
                      <option value="">Selecciona un jugador…</option>
                      {doblarCandidates.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
