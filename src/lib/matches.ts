import type { Database } from "@/integrations/supabase/types";

/** Fila de la tabla `matches` de Supabase. */
export type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

/**
 * Ordena los partidos cronológicamente (fecha + hora ascendente).
 * `match_time` puede ser null; se trata como cadena vacía a efectos de orden.
 */
export function sortMatches<T extends { match_date: string; match_time: string | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) =>
    (a.match_date + (a.match_time ?? "")).localeCompare(b.match_date + (b.match_time ?? "")),
  );
}

/**
 * Devuelve el enfrentamiento en orden federativo Local – Visitante.
 * Si el equipo del club juega en casa, es el local; si no, el visitante.
 */
export function localVisitante(
  match: Pick<MatchRow, "is_home" | "opponent">,
  ownTeamName: string,
): { local: string; visitante: string } {
  return match.is_home
    ? { local: ownTeamName, visitante: match.opponent }
    : { local: match.opponent, visitante: ownTeamName };
}

/** URL de búsqueda de Google Maps para la dirección/pabellón indicado. */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
