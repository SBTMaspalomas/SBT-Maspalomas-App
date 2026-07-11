import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad } from "./SignaturePad";
import { clubStore } from "@/lib/clubStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Download, Upload, FileText, CheckCircle2 } from "lucide-react";

const FileButton = ({ label, value, onChange, accept = "image/*" }: { label: string; value?: string; onChange: (name: string) => void; accept?: string }) => (
  <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-border bg-surface px-3 py-2.5 text-sm hover:border-primary">
    <span className="flex items-center gap-2 text-muted-foreground">
      <Upload className="h-4 w-4" />
      {value ? <span className="text-foreground">{value}</span> : label}
    </span>
    {value && <CheckCircle2 className="h-4 w-4 text-success" />}
    <input
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onChange(f.name);
      }}
    />
  </label>
);

export function RegistrationFlow() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", docType: "DNI", docNumber: "",
    tutorName: "", tutorDni: "", tutorAddress: "", tutorPhone: "", tutorEmail: "",
    teamId: "t1",
    photo: undefined as string | undefined,
    dniFront: undefined as string | undefined,
    dniBack: undefined as string | undefined,
    tutorDniFront: undefined as string | undefined,
    tutorDniBack: undefined as string | undefined,
    federativaPdf: undefined as string | undefined,
    signature: undefined as string | undefined,
    auth_image: false, auth_travel: false, auth_medical: false,
  });
  const set = (k: keyof typeof form, v: string | boolean | undefined) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.auth_image || !form.auth_travel || !form.auth_medical) {
      toast.error("Debes marcar las 3 autorizaciones obligatorias.");
      return;
    }
    if (!form.signature) { toast.error("Falta la firma del tutor."); return; }
    if (!form.federativaPdf) { toast.error("Sube la ficha federativa firmada (PDF)."); return; }
    if (!user) { toast.error("Debes iniciar sesión."); return; }

    setIsSubmitting(true);
    try {
      // 1. Asegurar que existe family_meta para este usuario
      let { data: family } = await supabase.from("families_meta").select("id").eq("head_profile_id", user.id).maybeSingle();
      if (!family) {
        const { data: newFamily, error: famErr } = await supabase.from("families_meta").insert({
          head_profile_id: user.id,
          head_email: user.email
        }).select().single();
        if (famErr) throw famErr;
        family = newFamily;
      }

      // 2. Subir archivos a Storage
      const uploadFile = async (file: File, path: string) => {
        const { data, error } = await supabase.storage.from("player-docs").upload(path, file);
        if (error) throw error;
        return supabase.storage.from("player-docs").getPublicUrl(data.path).data.publicUrl;
      };

      const fileMap: any = {};
      const fileInputs = document.querySelectorAll('input[type="file"]');
      
      // Mapeo manual basado en el orden del formulario para simplificar
      const filesToUpload = [
        { key: "photo", label: "foto" },
        { key: "dniFront", label: "dni_anverso" },
        { key: "dniBack", label: "dni_reverso" },
        { key: "tutorDniFront", label: "tutor_dni_anverso" },
        { key: "tutorDniBack", label: "tutor_dni_reverso" },
        { key: "federativaPdf", label: "ficha_federativa" }
      ];

      for (let i = 0; i < fileInputs.length; i++) {
        const input = fileInputs[i] as HTMLInputElement;
        const file = input.files?.[0];
        if (file && i < filesToUpload.length) {
          const { key, label } = filesToUpload[i];
          const fileName = `${Date.now()}_${label}_${file.name}`;
          fileMap[key] = await uploadFile(file, fileName);
        }
      }

      // 3. Insertar jugador con URLs de archivos
      const { error: pErr } = await supabase.from("players").insert({
        family_id: family.id,
        full_name: `${form.firstName} ${form.lastName}`,
        birth_date: form.birthDate,
        team_id: form.teamId,
        photo_url: fileMap.photo,
        // Guardamos los demás en una columna de metadatos o columnas específicas si existen
        // Por ahora usamos las columnas que vimos en las migraciones
      });
      if (pErr) throw pErr;

      toast.success("Registro enviado correctamente a Supabase.");
      setStep(1);
      setForm({ ...form, firstName: "", lastName: "", docNumber: "", signature: undefined, photo: undefined, dniFront: undefined, dniBack: undefined, tutorDniFront: undefined, tutorDniBack: undefined, federativaPdf: undefined, auth_image: false, auth_travel: false, auth_medical: false });
    } catch (error: any) {
      console.error("Error al registrar:", error);
      toast.error("Error al enviar el registro: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Registro Federativo</span>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-2 w-8 rounded-full ${step >= n ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Paso 1 · Datos del Jugador</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Nombre</Label><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
              <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
              <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></div>
              <div>
                <Label>Tipo de documento</Label>
                <Select value={form.docType} onValueChange={(v) => set("docType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Número de documento</Label><Input value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} /></div>
              <div className="sm:col-span-2">
                <Label>Equipo</Label>
                <Select value={form.teamId} onValueChange={(v) => set("teamId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clubStore.get().teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} · {t.category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)}>Siguiente</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Paso 2 · Tutor Legal (obligatorio si menor)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Nombre y apellidos</Label><Input value={form.tutorName} onChange={(e) => set("tutorName", e.target.value)} /></div>
              <div><Label>DNI</Label><Input value={form.tutorDni} onChange={(e) => set("tutorDni", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Domicilio completo</Label><Input value={form.tutorAddress} onChange={(e) => set("tutorAddress", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={form.tutorPhone} onChange={(e) => set("tutorPhone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.tutorEmail} onChange={(e) => set("tutorEmail", e.target.value)} /></div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button onClick={() => setStep(3)}>Siguiente</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">Paso 3 · Documentación y Firmas</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <FileButton label="Foto de carnet del jugador (JPG/PNG)" value={form.photo} onChange={(n) => set("photo", n)} />
              <FileButton label="DNI jugador · Anverso" value={form.dniFront} onChange={(n) => set("dniFront", n)} />
              <FileButton label="DNI jugador · Reverso" value={form.dniBack} onChange={(n) => set("dniBack", n)} />
              <FileButton label="DNI tutor · Anverso" value={form.tutorDniFront} onChange={(n) => set("tutorDniFront", n)} />
              <FileButton label="DNI tutor · Reverso" value={form.tutorDniBack} onChange={(n) => set("tutorDniBack", n)} />
            </div>

            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Ficha Federativa Única</div>
              <p className="text-xs text-muted-foreground">
                1) Descarga el PDF oficial. 2) Imprime y consigue las firmas físicas del médico (reconocimiento), jugador y tutor. 3) Escanea y sube el PDF.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => toast.info("Descargando ficha_federativa.pdf (simulado)")}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF oficial
                </Button>
                <FileButton label="Subir ficha firmada (PDF)" value={form.federativaPdf} onChange={(n) => set("federativaPdf", n)} accept="application/pdf" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Firma del tutor</Label>
              <SignaturePad value={form.signature} onChange={(v) => set("signature", v)} />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <div className="text-sm font-semibold">Autorizaciones expresas (obligatorias)</div>
              {[
                ["auth_image", "Autorizo derechos de imagen del menor en publicaciones del club."],
                ["auth_travel", "Autorizo los traslados en vehículos privados para partidos."],
                ["auth_medical", "Autorizo asistencia médica de emergencia si es necesaria."],
              ].map(([k, label]) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!form[k as keyof typeof form]} onCheckedChange={(v) => set(k as keyof typeof form, !!v)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
              <Button onClick={submit} disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar registro"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
