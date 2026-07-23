import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ==================== BRANDING DEL CLUB ====================
// El logo de la aplicación no está hardcodeado: se guarda en la tabla
// `app_settings` (clave `logo_url`) y lo edita el administrador subiendo un
// fichero PNG, JPG o GIF al bucket de Storage `branding`. El valor de abajo solo
// se usa como respaldo si la tabla aún no existe o no se pudo leer.
export const DEFAULT_LOGO_URL =
  "https://kiifznmcpyvalupdtnrq.supabase.co/storage/v1/object/public/avatars/SBT%20logo-.png";

/** Clave de `app_settings` donde se almacena la URL pública del logo. */
export const LOGO_SETTING_KEY = "logo_url";

// Evento global para que todas las vistas que muestran el logo (login y
// cabecera) se refresquen al instante cuando el administrador lo cambia, sin
// necesidad de recargar la página.
const LOGO_UPDATED_EVENT = "app-logo-updated";

/** Notifica a toda la app que el logo ha cambiado a la nueva URL indicada. */
export function emitLogoUpdated(url: string) {
  window.dispatchEvent(new CustomEvent(LOGO_UPDATED_EVENT, { detail: url }));
}

/**
 * Devuelve la URL del logo del club configurada por el administrador, con
 * respaldo en `DEFAULT_LOGO_URL`. Funciona tanto para usuarios autenticados como
 * anónimos (la pantalla de login lo usa antes de iniciar sesión). Se mantiene
 * sincronizado en vivo mediante el evento `app-logo-updated`.
 */
export function useLogoUrl() {
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    // La tabla puede no estar en los tipos generados; se accede con cast (patrón del repo).
    const { data, error } = await supabase
      .from("app_settings" as never)
      .select("value")
      .eq("key", LOGO_SETTING_KEY)
      .maybeSingle();
    const value = (data as { value: string | null } | null)?.value;
    if (!error && value) setLogoUrl(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (typeof url === "string" && url) setLogoUrl(url);
    };
    window.addEventListener(LOGO_UPDATED_EVENT, onUpdate as EventListener);
    return () => window.removeEventListener(LOGO_UPDATED_EVENT, onUpdate as EventListener);
  }, []);

  return { logoUrl, loading, reload };
}
