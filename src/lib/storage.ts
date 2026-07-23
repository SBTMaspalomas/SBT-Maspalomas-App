import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// Acceso a ficheros del bucket privado `player-docs`.
//
// El bucket dejó de ser público (guarda documentación sensible: ficha
// federativa, DNI/NIE/pasaporte, foto de carnet, comprobantes de pago…). Ya no
// se puede acceder por URL pública permanente: cada lectura genera una URL
// firmada de corta duración, y el firmante debe pasar las políticas SELECT de
// Storage (carpeta propia, jugador de su familia, recibo propio, o admin).
//
// Las columnas de la BD siguen guardando el valor histórico (una URL pública
// completa) o, en registros nuevos, una ruta; `playerDocPath` normaliza ambos
// casos extrayendo la ruta del objeto dentro del bucket.
// -----------------------------------------------------------------------------

const BUCKET = "player-docs";
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hora

/** Extrae la ruta del objeto dentro de `player-docs` a partir de un valor
 * guardado, que puede ser una URL pública/firmada completa (heredada) o ya una
 * ruta desnuda. */
export function playerDocPath(stored: string): string {
  for (const marker of [`/object/public/${BUCKET}/`, `/object/sign/${BUCKET}/`, `/${BUCKET}/`]) {
    const i = stored.indexOf(marker);
    if (i >= 0) {
      return decodeURIComponent(stored.slice(i + marker.length).split("?")[0]);
    }
  }
  return stored.replace(/^\/+/, "");
}

/** Genera una URL firmada de corta duración para un valor guardado. Devuelve
 * `null` si no hay valor o si el usuario no tiene permiso de lectura. */
export async function signPlayerDoc(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(playerDocPath(stored), SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Hook que resuelve un único valor guardado a una URL firmada. */
export function useSignedPlayerDoc(stored: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (stored) {
      signPlayerDoc(stored).then((u) => {
        if (active) setUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [stored]);
  return url;
}

/** Hook que resuelve una lista de valores guardados a un `Map<valor, urlFirmada>`.
 * Útil para listas: solo firma los valores presentes y sin duplicados. */
export function useSignedPlayerDocs(values: (string | null | undefined)[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const key = values.filter(Boolean).join("|");
  useEffect(() => {
    let active = true;
    const uniq = Array.from(new Set(values.filter((v): v is string => !!v)));
    if (uniq.length === 0) {
      setMap(new Map());
      return;
    }
    Promise.all(uniq.map(async (v) => [v, await signPlayerDoc(v)] as const)).then((pairs) => {
      if (!active) return;
      const next = new Map<string, string>();
      for (const [k, u] of pairs) if (u) next.set(k, u);
      setMap(next);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}
