import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/set-password")({
  head: () => ({ meta: [{ title: "Crea tu contraseña · SBT Maspalomas" }] }),
  component: SetPasswordPage,
});

// Primer acceso de las cuentas provisionadas por el club: el padre/tutor entra
// con la contraseña temporal y aquí fija la suya definitiva. Al guardar se limpia
// el flag must_change_password y se invalida la contraseña temporal almacenada.
function SetPasswordPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Si no hay sesión, no hay nada que cambiar → al login.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
    });
  }, [navigate]);

  // Navegar a inicio SOLO cuando el contexto ya refleja el flag limpio, para
  // evitar la carrera con el evento USER_UPDATED (que rebotaría aquí de nuevo).
  useEffect(() => {
    if (done && !auth.mustChangePassword) navigate({ to: "/" });
  }, [done, auth.mustChangePassword, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Invalidar la contraseña temporal guardada (best-effort: no bloquea el flujo).
    await supabase.rpc("clear_my_provisioned_password");
    setLoading(false);
    toast.success("Contraseña actualizada");
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Toaster theme="dark" position="top-center" />
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-black">Crea tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Es tu primer acceso. Elige una contraseña propia para reemplazar la temporal que te dio el club.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="np">Nueva contraseña</Label>
          <Input id="np" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp">Repite la contraseña</Label>
          <Input id="cp" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>Guardar y continuar</Button>
      </form>
    </div>
  );
}
