import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shirt, Plane } from "lucide-react";

interface TeamRow { id: string; name: string; category: string; travels: boolean }
interface PlayerRow { id: string; full_name: string; team_id: string | null }
interface PlayerTeamRow { player_id: string; team_id: string }
type SizeField = "reversible_size" | "tracksuit_size" | "polo_size" | "hoodie_size" | "backpack_size";
type SizeRow = Record<SizeField, string | null> & { player_id: string };
type Draft = Record<SizeField, string>;

const keyOf = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
const SIZE_OPTIONS = ["4", "6", "8", "10", "12", "14", "16", "XS", "S", "M", "L", "XL", "XXL", "Única"];

// La equipación reversible es común a todos; el resto sólo para equipos que viajan.
const BASE_FIELDS: { field: SizeField; label: string }[] = [
  { field: "reversible_size", label: "Equipación reversible" },
];
const TRAVEL_FIELDS: { field: SizeField; label: string }[] = [
  { field: "tracksuit_size", label: "Chándal" },
  { field: "polo_size", label: "Polo de paseo" },
  { field: "hoodie_size", label: "Sudadera" },
  { field: "backpack_size", label: "Mochila reglamentaria" },
];
const EMPTY_DRAFT: Draft = {
  reversible_size: "", tracksuit_size: "", polo_size: "", hoodie_size: "", backpack_size: "",
};

export function EquipmentSizes({ playerId }: { playerId?: string } = {}) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [playerTeams, setPlayerTeams] = useState<PlayerTeamRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [playersRes, teamsRes, ptRes] = await Promise.all([
      playerId
        ? supabase.from("players").select("id, full_name, team_id").eq("id", playerId)
        : supabase.from("players").select("id, full_name, team_id").order("full_name"),
      supabase.from("teams").select("id, name, category, travels").order("name"),
      supabase.from("player_teams").select("player_id, team_id"),
    ]);
    const ps = (playersRes.data ?? []) as PlayerRow[];
    setPlayers(ps);
    setTeams((teamsRes.data ?? []) as TeamRow[]);
    setPlayerTeams((ptRes.data ?? []) as PlayerTeamRow[]);

    const ids = ps.map((p) => p.id);
    const nextDrafts: Record<string, Draft> = {};
    ps.forEach((p) => { nextDrafts[p.id] = { ...EMPTY_DRAFT }; });
    if (ids.length > 0) {
      const { data: sizes } = await supabase
        .from("equipment_sizes")
        .select("player_id, reversible_size, tracksuit_size, polo_size, hoodie_size, backpack_size")
        .in("player_id", ids);
      ((sizes ?? []) as SizeRow[]).forEach((s) => {
        nextDrafts[s.player_id] = {
          reversible_size: s.reversible_size ?? "",
          tracksuit_size: s.tracksuit_size ?? "",
          polo_size: s.polo_size ?? "",
          hoodie_size: s.hoodie_size ?? "",
          backpack_size: s.backpack_size ?? "",
        };
      });
    }
    setDrafts(nextDrafts);
    setLoading(false);
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  // ¿El jugador está en algún equipo que viaja? → pack completo de ropa.
  const travelsByPlayer = useMemo(() => {
    const result: Record<string, boolean> = {};
    players.forEach((p) => {
      const teamIds = new Set(playerTeams.filter((pt) => pt.player_id === p.id).map((pt) => pt.team_id));
      const assigned = teams.filter(
        (t) => teamIds.has(t.id) || keyOf(t.id) === keyOf(p.team_id) || keyOf(t.name) === keyOf(p.team_id),
      );
      result[p.id] = assigned.some((t) => t.travels);
    });
    return result;
  }, [players, teams, playerTeams]);

  const setDraftField = (pid: string, field: SizeField, value: string) =>
    setDrafts((prev) => ({ ...prev, [pid]: { ...(prev[pid] ?? EMPTY_DRAFT), [field]: value } }));

  const save = async (pid: string) => {
    const draft = drafts[pid] ?? EMPTY_DRAFT;
    const travels = travelsByPlayer[pid];
    // Sólo se persisten los campos aplicables al nivel del equipo.
    const payload: Partial<Record<SizeField, string | null>> = {
      reversible_size: draft.reversible_size || null,
      tracksuit_size: travels ? (draft.tracksuit_size || null) : null,
      polo_size: travels ? (draft.polo_size || null) : null,
      hoodie_size: travels ? (draft.hoodie_size || null) : null,
      backpack_size: travels ? (draft.backpack_size || null) : null,
    };
    setSavingId(pid);
    const { error } = await supabase
      .from("equipment_sizes")
      .upsert({ player_id: pid, ...payload }, { onConflict: "player_id" });
    setSavingId(null);
    if (error) { toast.error("No se pudieron guardar las tallas"); return; }
    toast.success("Tallas guardadas");
  };

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent></Card>;
  }
  if (players.length === 0) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        No hay jugadores asociados a tu cuenta todavía.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Tallas / Equipación</h2>
        <p className="text-sm text-muted-foreground">
          Indica las tallas de cada jugador. Los equipos que viajan añaden el pack completo de ropa.
        </p>
      </div>

      {players.map((player) => {
        const travels = travelsByPlayer[player.id];
        const fields = travels ? [...BASE_FIELDS, ...TRAVEL_FIELDS] : BASE_FIELDS;
        const draft = drafts[player.id] ?? EMPTY_DRAFT;
        return (
          <Card key={player.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shirt className="h-4 w-4 text-muted-foreground" />
                {player.full_name}
              </CardTitle>
              {travels && (
                <Badge variant="outline" className="text-xs">
                  <Plane className="mr-1 h-3 w-3" /> Equipo que viaja
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map(({ field, label }) => (
                  <div key={field}>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
                    <Select value={draft[field] || undefined} onValueChange={(v) => setDraftField(player.id, field, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona talla" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={savingId === player.id} onClick={() => save(player.id)}>
                  {savingId === player.id ? "Guardando…" : "Guardar tallas"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
