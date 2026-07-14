'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad } from "./SignaturePad";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";
import { useState } from "react";

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
  
  // Datos del adulto
  const [adult, setAdult] = useState({
    firstName: "", lastName: "", birthDate: "", docType: "DNI", docNumber: "",
    phone: "", email: "", isResponsible: false
  });
  
  // Datos de hijos
  const [children, setChildren] = useState<Array<{firstName: string; lastName: string; birthDate: string; docNumber: string}>>([]);
  const [currentChild, setCurrentChild] = useState({firstName: "", lastName: "", birthDate: "", docNumber: ""});
  
  // Documentación
  const [docs, setDocs] = useState({
    photo: "", dniFront: "", dniBack: "", signature: "", auth_image: false, auth_travel: false, auth_medical: false, auth_data_sharing: false
  });

  const handleAdultChange = (field: string, value: string | boolean) => {
    setAdult(prev => ({...prev, [field]: value}));
  };

  const handleChildChange = (field: string, value: string) => {
    setCurrentChild(prev => ({...prev, [field]: value}));
  };

  const addChild = () => {
    if (!currentChild.firstName || !currentChild.lastName || !currentChild.birthDate || !currentChild.docNumber) {
      toast.error("Completa todos los datos del hijo");
      return;
    }
    setChildren([...children, currentChild]);
    setCurrentChild({firstName: "", lastName: "", birthDate: "", docNumber: ""});
    toast.success("Hijo agregado");
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleDocChange = (field: string, value: string | boolean) => {
    setDocs(prev => ({...prev, [field]: value}));
  };

  const submit = async () => {
    // Validar autorizaciones obligatorias
    if (!docs.auth_data_sharing) {
      toast.error("Debes aceptar la autorización de compartir datos");
      return;
    }

    // Si hay hijos, validar autorizaciones de menores
    if (adult.isResponsible && children.length > 0) {
      // Las autorizaciones de menores son opcionales, no hay validación
    }

    if (!docs.signature) {
      toast.error("Falta la firma");
      return;
    }

    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Crear o actualizar perfil del adulto
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: user.id,
        email: adult.email,
        full_name: `${adult.firstName} ${adult.lastName}`,
      });
      if (profileErr) throw profileErr;

      // 2. Si es responsable de menores, crear family_meta
      let familyId: string | null = null;
      if (adult.isResponsible && children.length > 0) {
        let { data: family } = await supabase.from("families_meta").select("id").eq("head_profile_id", user.id).maybeSingle();
        if (!family) {
          const { data: newFamily, error: famErr } = await supabase.from("families_meta").insert({
            head_profile_id: user.id,
            head_email: user.email
          }).select().single();
          if (famErr) throw famErr;
          family = newFamily;
        }
        familyId = family.id;
      }

      // 3. Subir archivos
      const uploadFile = async (file: File, path: string) => {
        const { data, error } = await supabase.storage.from("player-docs").upload(path, file);
        if (error) throw error;
        return supabase.storage.from("player-docs").getPublicUrl(data.path).data.publicUrl;
      };

      const fileMap: any = {};
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const filesToUpload = [
        { key: "photo", label: "foto" },
        { key: "dniFront", label: "dni_anverso" },
        { key: "dniBack", label: "dni_reverso" }
      ];

      for (let i = 0; i < fileInputs.length && i < filesToUpload.length; i++) {
        const input = fileInputs[i] as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
          const { key, label } = filesToUpload[i];
          const fileName = `${Date.now()}_${label}_${file.name}`;
          fileMap[key] = await uploadFile(file, `${user.id}/${fileName}`);
        }
      }

      // 4. Crear hijos si aplica (guardar como players con family_id)
      if (adult.isResponsible && children.length > 0 && familyId) {
        for (const child of children) {
          await supabase.from("players").insert({
            family_id: familyId,
            full_name: `${child.firstName} ${child.lastName}`,
            birth_date: child.birthDate,
            document_number: child.docNumber
          } as any);
        }
      }

      toast.success("Registro completado exitosamente");
      setStep(1);
      setAdult({firstName: "", lastName: "", birthDate: "", docType: "DNI", docNumber: "", phone: "", email: "", isResponsible: false});
      setChildren([]);
      setDocs({photo: "", dniFront: "", dniBack: "", signature: "", auth_image: false, auth_travel: false, auth_medical: false, auth_data_sharing: false});
    } catch (err: any) {
      console.error("Error en registro:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PASO 1: Datos del adulto */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos Personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input value={adult.firstName} onChange={(e) => handleAdultChange("firstName", e.target.value)} />
              </div>
              <div>
                <Label>Apellidos</Label>
                <Input value={adult.lastName} onChange={(e) => handleAdultChange("lastName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Documento</Label>
                <Select value={adult.docType} onValueChange={(v) => handleAdultChange("docType", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Número de Documento</Label>
                <Input value={adult.docNumber} onChange={(e) => handleAdultChange("docNumber", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Fecha de Nacimiento</Label>
              <Input type="date" value={adult.birthDate} onChange={(e) => handleAdultChange("birthDate", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <Input value={adult.phone} onChange={(e) => handleAdultChange("phone", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={adult.email} onChange={(e) => handleAdultChange("email", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={adult.isResponsible} onCheckedChange={(v) => handleAdultChange("isResponsible", v)} />
              <Label>Soy adulto responsable de un menor de edad</Label>
            </div>
            <Button onClick={() => setStep(adult.isResponsible ? 2 : 3)} className="w-full">Siguiente</Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 2: Datos de hijos (solo si es responsable) */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos de Menores a Cargo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {children.map((child, idx) => (
              <div key={idx} className="p-3 bg-surface rounded border border-border flex justify-between items-center">
                <span>{child.firstName} {child.lastName}</span>
                <Button variant="destructive" size="sm" onClick={() => removeChild(idx)}>Eliminar</Button>
              </div>
            ))}
            <div className="space-y-3 p-3 bg-muted rounded">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Nombre del menor</Label>
                  <Input value={currentChild.firstName} onChange={(e) => handleChildChange("firstName", e.target.value)} size={1} />
                </div>
                <div>
                  <Label className="text-sm">Apellidos</Label>
                  <Input value={currentChild.lastName} onChange={(e) => handleChildChange("lastName", e.target.value)} size={1} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Fecha de nacimiento</Label>
                  <Input type="date" value={currentChild.birthDate} onChange={(e) => handleChildChange("birthDate", e.target.value)} size={1} />
                </div>
                <div>
                  <Label className="text-sm">DNI/Documento</Label>
                  <Input value={currentChild.docNumber} onChange={(e) => handleChildChange("docNumber", e.target.value)} size={1} />
                </div>
              </div>
              <Button onClick={addChild} variant="outline" className="w-full">Agregar otro menor</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
              <Button onClick={() => {
                // Auto-agregar hijo actual si tiene datos pero no se pulsó "Agregar"
                if (currentChild.firstName && currentChild.lastName && currentChild.birthDate && currentChild.docNumber && children.length === 0) {
                  setChildren([...children, currentChild]);
                  setCurrentChild({firstName: "", lastName: "", birthDate: "", docNumber: ""});
                }
                setStep(3);
              }} className="flex-1">Siguiente</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 3/4: Documentación */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Documentación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Foto del adulto</Label>
              <FileButton label="Seleccionar foto" value={docs.photo} onChange={(name) => handleDocChange("photo", name)} accept="image/*" />
            </div>
            <div>
              <Label className="mb-2 block">DNI - Anverso</Label>
              <FileButton label="Seleccionar archivo" value={docs.dniFront} onChange={(name) => handleDocChange("dniFront", name)} accept="image/*" />
            </div>
            <div>
              <Label className="mb-2 block">DNI - Reverso</Label>
              <FileButton label="Seleccionar archivo" value={docs.dniBack} onChange={(name) => handleDocChange("dniBack", name)} accept="image/*" />
            </div>

            {/* Autorizaciones */}
            <div className="space-y-3 p-3 bg-muted rounded">
              <p className="font-semibold text-sm">Autorizaciones</p>
             
              {adult.isResponsible && (
                <>
                  <div className="flex items-start space-x-2">
                    <Checkbox checked={docs.auth_image} onCheckedChange={(v) => handleDocChange("auth_image", v)} />
                    <Label className="text-sm">Autorizo los derechos de imagen del menor en publicaciones del club.</Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox checked={docs.auth_travel} onCheckedChange={(v) => handleDocChange("auth_travel", v)} />
                    <Label className="text-sm">Autorizo sus eventuales traslados en vehículos privados para partidos.</Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox checked={docs.auth_medical} onCheckedChange={(v) => handleDocChange("auth_medical", v)} />
                    <Label className="text-sm">Autorizo su asistencia médica en casos de emergencia que así lo requieran a juicio de los adultos responsables del menor en ese momento.</Label>
                  </div>
                </>
              )}

              <div className="flex items-start space-x-2 p-3 rounded border border-amber-500/50 bg-amber-500/10">
                <Checkbox checked={docs.auth_data_sharing} onCheckedChange={(v) => handleDocChange("auth_data_sharing", v)} />
                <Label className="text-sm font-semibold text-foreground">Autorizo que se compartan nuestros datos personales con federaciones, seguros deportivos, entidades públicas de las que dependa nuestra actividad, compañías de transporte e instalaciones hoteleras en caso de viajes, y para cualquier otro uso legítimo requerido por el propio desarrollo de nuestra función esencial.</Label>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Firma del adulto responsable</Label>
              <SignaturePad value={docs.signature} onChange={(sig) => handleDocChange("signature", sig || "")} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(adult.isResponsible ? 2 : 1)} className="flex-1">Atrás</Button>
              <Button onClick={submit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Enviando..." : "Completar Registro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
