import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMatches } from "@/hooks/use-matches";
import { localVisitante, mapsUrl } from "@/lib/matches";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Calendar, Clock, MapPin, Trophy, Trash2, Home, Bus } from "lucide-react";

interface TeamRow {
  id: string;
  name: string;
  category: string;
}

const keyOf = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const emptyForm = {
  team_id: "",
  opponent: "",
  is_home: "true" as "true" | "false",
  match_date: "",
  match_time: "",
  venue: "",
  venue_address: "",
  phase: "",
  match_number: "",
  notes: "",
};

export function MatchesManager() {
  const { user, role } = useAuth();
  const canManage = role === "admin" || role === "coach";

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [manageTeamIds, setManageTeamIds] = useState<string[] | undefined>(undefined);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  // Los partidos se leen siempre completos (RLS permite lectura a todo
  // autenticado); el scoping por equipo del coach se aplica solo al listado.
  const { matches, loading, reload } = useMatches();

  // Cargar equipos: admin ve todos; coach solo los suyos (coach_teams).
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [coachTeamsResult, teamsResult] = await Promise.all([
        role === "admin" || !canManage
          ? Promise.resolve({ data: [], error: null })
          : supabase.from("coach_teams").select("team_id").eq("user_id", user.id),
        supabase.from("teams").select("id, name, category").order("name"),
      ]);
      if (!active) return;
      const allTeams = (teamsResult.data ?? []) as TeamRow[];
      if (role === "coach") {
        const assignedKeys = new Set(
          (coachTeamsResult.data ?? []).map((r) => keyOf(String(r.team_id ?? ""))).filter(Boolean),
        );
        const ts = allTeams.filter(
          (t) =>
            assignedKeys.has(keyOf(t.id)) ||
            assignedKeys.has(keyOf(t.name)) ||
            assignedKeys.has(keyOf(t.category)),
        );
        setTeams(ts);
        setManageTeamIds(ts.map((t) => t.id));
      } else {
        setTeams(allTeams);
        setManageTeamIds(undefined);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, role, canManage]);

  const teamName = useCallback(
    (id: string) => teams.find((t) => t.id === id)?.name ?? "Nuestro equipo",
    [teams],
  );

  // El coach solo ve en el listado los partidos de sus equipos.
  const visibleMatches = useMemo(() => {
    if (role !== "coach" || !manageTeamIds) return matches;
    const set = new Set(manageTeamIds);
    return matches.filter((m) => set.has(m.team_id));
  }, [matches, role, manageTeamIds]);

  const handleCreate = async () => {
    if (!formData.team_id || !formData.opponent.trim() || !formData.match_date) {
      toast.error("Completa equipo, rival y fecha");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    const { error } = await supabase.from("matches").insert({
      team_id: formData.team_id,
      opponent: formData.opponent.trim(),
      is_home: formData.is_home === "true",
      match_date: formData.match_date,
      match_time: formData.match_time || null,
      venue: formData.venue.trim() || null,
      venue_address: formData.venue_address.trim() || null,
      phase: formData.phase.trim() || null,
      match_number: formData.match_number.trim() || null,
      notes: formData.notes.trim() || null,
      created_by: user.id,
    });
    if (error) {
      toast.error("Error al crear el partido");
      return;
    }
    toast.success("Partido creado");
    setFormData(emptyForm);
    setOpenDialog(false);
    reload();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar el partido");
      return;
    }
    toast.success("Partido eliminado");
    reload();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Partidos</h2>
          <p className="text-sm text-muted-foreground">Calendario y jornadas del club</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {/* Importación de Excel: reservada para una fase posterior. */}
            <Button variant="outline" disabled title="Importación de Excel — próximamente">
              <Upload className="mr-2 h-4 w-4" />
              Importar Excel
            </Button>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo partido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear partido</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
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

                  <div>
                    <label className="text-sm font-medium">Rival</label>
                    <Input
                      value={formData.opponent}
                      onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                      placeholder="Ej: CB Gran Canaria"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Condición</label>
                    <select
                      value={formData.is_home}
                      onChange={(e) =>
                        setFormData({ ...formData, is_home: e.target.value as "true" | "false" })
                      }
                      className="w-full rounded border border-border bg-background p-2 text-sm"
                    >
                      <option value="true">En casa (CASA)</option>
                      <option value="false">Fuera (FUERA)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium">Fecha</label>
                      <Input
                        type="date"
                        value={formData.match_date}
                        onChange={(e) => setFormData({ ...formData, match_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Hora</label>
                      <Input
                        type="time"
                        value={formData.match_time}
                        onChange={(e) => setFormData({ ...formData, match_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Pabellón</label>
                    <Input
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      placeholder="Ej: Pabellón Municipal de Maspalomas"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Dirección del pabellón</label>
                    <Input
                      value={formData.venue_address}
                      onChange={(e) => setFormData({ ...formData, venue_address: e.target.value })}
                      placeholder="Para abrir la ruta en Google Maps"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium">Fase (opcional)</label>
                      <Input
                        value={formData.phase}
                        onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                        placeholder="Ej: Liga Regular · 1ª Vuelta"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Nº de acta (opcional)</label>
                      <Input
                        value={formData.match_number}
                        onChange={(e) => setFormData({ ...formData, match_number: e.target.value })}
                        placeholder="Nº oficial federativo"
                      />
                    </div>
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

                  <Button onClick={handleCreate} className="w-full">
                    Crear partido
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Listado */}
      <div className="space-y-2">
        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </Card>
        ) : visibleMatches.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay partidos programados</p>
          </Card>
        ) : (
          visibleMatches.map((m) => {
            const { local, visitante } = localVisitante(m, teamName(m.team_id));
            const dateStr = new Date(m.match_date).toLocaleDateString("es-ES", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            });
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.is_home ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}
                      >
                        {m.is_home ? <Home className="h-3 w-3" /> : <Bus className="h-3 w-3" />}
                        {m.is_home ? "CASA" : "FUERA"}
                      </span>
                      {m.phase && (
                        <Badge variant="secondary" className="text-[10px]">
                          {m.phase}
                        </Badge>
                      )}
                      {m.match_number && (
                        <span className="text-[10px] text-muted-foreground">
                          Acta {m.match_number}
                        </span>
                      )}
                    </div>

                    <div className="truncate text-base font-black">
                      {local} <span className="text-xs font-normal text-muted-foreground">vs</span>{" "}
                      {visitante}
                    </div>

                    <div className="mt-1 space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /> {dateStr}
                        {m.match_time && (
                          <>
                            <Clock className="ml-1 h-4 w-4" /> {m.match_time}
                          </>
                        )}
                      </div>
                      {m.venue && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {m.venue_address ? (
                            <a
                              className="text-primary hover:underline"
                              href={mapsUrl(m.venue_address)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {m.venue} · abrir en Maps
                            </a>
                          ) : (
                            <span>{m.venue}</span>
                          )}
                        </div>
                      )}
                      {m.notes && <p className="text-xs italic text-muted-foreground">{m.notes}</p>}
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(m.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {visibleMatches.length > 0 && (
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Trophy className="h-3 w-3" /> {visibleMatches.length} partido
          {visibleMatches.length === 1 ? "" : "s"} en el calendario
        </p>
      )}
    </div>
  );
}
