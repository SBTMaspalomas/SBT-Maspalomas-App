import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Upload, X } from "lucide-react";

interface AvatarUploadProps {
  currentUrl?: string | null;
  entityId: string;
  entityType: "player" | "profile";
  onUploaded: (url: string) => void;
}

const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXT = ".jpg, .jpeg, .png, .webp";

export function AvatarUpload({ currentUrl, entityId, entityType, onUploaded }: AvatarUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato no admitido. Usa JPG, PNG o WebP.");
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

  const handleUpload = async () => {
    const file = selectedFile.current;
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${entityType}_${entityId}_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("player-docs")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const publicUrl = supabase.storage.from("player-docs").getPublicUrl(data.path).data.publicUrl;

      // Actualizar en la tabla correspondiente
      if (entityType === "player") {
        await supabase.from("players").update({ avatar_url: publicUrl } as any).eq("id", entityId);
      } else {
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", entityId);
      }

      onUploaded(publicUrl);
      toast.success("Avatar actualizado");
      setOpen(false);
      setPreview(null);
      selectedFile.current = null;
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
          title="Cambiar avatar"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Personalizar avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-center">
            {preview ? (
              <div className="relative mx-auto w-fit">
                <img src={preview} alt="Vista previa" className="mx-auto h-32 w-32 rounded-full object-cover" />
                <button
                  onClick={() => { setPreview(null); selectedFile.current = null; }}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer space-y-2 py-4"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pulsa para seleccionar imagen</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_EXT}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Formatos admitidos:</strong> JPG, PNG, WebP</p>
            <p><strong>Tamaño máximo:</strong> {MAX_SIZE_MB} MB</p>
            <p><strong>Resolución recomendada:</strong> 400×400 px (cuadrada)</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setPreview(null); }}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!preview || uploading} onClick={handleUpload}>
              {uploading ? "Subiendo..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
