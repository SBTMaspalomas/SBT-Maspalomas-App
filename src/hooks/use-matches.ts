import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sortMatches, type MatchRow } from "@/lib/matches";

/**
 * Carga los partidos reales desde Supabase (tabla `matches`), ordenados por
 * fecha/hora. Si se pasa `teamIds` (UUID de equipo), filtra en cliente por esos
 * equipos; si es `undefined` devuelve todos (uso de admin/coach y vistas de club).
 *
 * Sigue el patrón del resto de la app: estado local + re-fetch manual, sin
 * react-query. La hidratación en vivo llega vía el canal Realtime global de
 * `useClubData`, pero se expone `reload` para refrescar tras una mutación local.
 */
export function useMatches(teamIds?: string[]): {
  matches: MatchRow[];
  loading: boolean;
  reload: () => void;
} {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Clave estable para no re-disparar el efecto por identidad del array.
  const teamKey = teamIds ? [...teamIds].sort().join(",") : null;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });
    if (error) {
      console.error("useMatches: error cargando partidos", error);
      setRows([]);
    } else {
      setRows((data ?? []) as MatchRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matches = useMemo(() => {
    const filtered =
      teamKey === null ? rows : rows.filter((m) => teamKey.split(",").includes(m.team_id));
    return sortMatches(filtered);
  }, [rows, teamKey]);

  return { matches, loading, reload: load };
}
