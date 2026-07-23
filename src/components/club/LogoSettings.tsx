import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Save, X } from "lucide-react";
import {
  DEFAULT_LOGO_URL,
  LOGO_SETTING_KEY,
  emitLogoUpdated,
  useLogoUrl,
} from "@/hooks/use-branding";

// Formatos y tamaño admitidos para el logo del club.
const MAX_SIZE_MB = 3;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif"];
const ACCEPTED_EXT = ".png,.jpg,.jpeg,.gif";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

/**
 * Editor del logo de la aplicación (solo administrador). Permite subir un fichero
 * PNG, JPG o GIF al bucket `branding` y guardar su URL pública en
 * `app_settings.logo_url`. El cambio se refleja al instante en la cabecera y en
 * la pantalla de login gracias al evento `app-logo-updated`.
 */
export function LogoSettings() {
  const { logoUrl, reload } = useLogoUrl();
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato no admitido. Usa PNG, JPG o GIF.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`El archivo excede ${MAX_SIZE_MB} MB. Reduce el tamaño o la resolución.`);
      return;
    }

    selectedFile.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearSelection = () => {
    selectedFile.current = null;
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    const file = selectedFile.current;
    if (!file) return;

    setSaving(true);
    try {
      const ext = EXT_BY_TYPE[file.type] ?? "png";
      // Nombre único (timestamp) para evitar servir una versión antigua cacheada.
      const path = `logo_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;

      const publicUrl = supabase.storage.from("branding").getPublicUrl(data.path).data.publicUrl;

      const { error: upsertErr } = await supabase
        .from("app_settings" as never)
        .upsert({ key: LOGO_SETTING_KEY, value: publicUrl } as never, { onConflict: "key" });
      if (upsertErr) throw upsertErr;

      emitLogoUpdated(publicUrl);
      await reload();
      clearSelection();
      toast.success("Logo actualizado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`No se pudo guardar el logo: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ImageIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-wider">Logo del club</h3>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Actual
            </div>
            <img
              src={logoUrl}
              alt="Logo actual"
              className="h-20 w-20 rounded-full border border-border object-cover"
            />
          </div>

          {preview && (
            <>
              <div className="text-2xl text-muted-foreground">→</div>
              <div className="relative text-center">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-primary">Nuevo</div>
                <img
                  src={preview}
                  alt="Vista previa del nuevo logo"
                  className="h-20 w-20 rounded-full border border-primary object-cover"
                />
                <button
                  onClick={clearSelection}
                  className="absolute -right-2 top-4 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white"
                  title="Descartar selección"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-lg border border-dashed border-border bg-surface p-4 text-center transition-colors hover:border-primary"
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Pulsa para seleccionar una imagen</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Formatos admitidos:</strong> PNG, JPG, GIF
          </p>
          <p>
            <strong>Tamaño máximo:</strong> {MAX_SIZE_MB} MB
          </p>
          <p>
            <strong>Recomendado:</strong> imagen cuadrada (p. ej. 512×512 px)
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!preview || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Guardar logo"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Se exporta el respaldo por si otras vistas lo necesitan sin cargar el hook.
export { DEFAULT_LOGO_URL };
