import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { Eye, EyeOff } from "lucide-react";

function PasswordInput({ id, value, onChange, minLength }: { id: string; value: string; onChange: (v: string) => void; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso · Club Hoops" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // If already signed in, bounce to home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido!");
    navigate({ to: "/" });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. Iniciando sesión...");
    // auto-confirm is on → session is active
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: "/" });
    else setMode("login");
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Si el correo existe, te enviaremos instrucciones.");
    setMode("login");
  };

  const onGoogle = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { setLoading(false); toast.error("No se pudo iniciar sesión con Google"); return; }
    if (res.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Toaster theme="dark" position="top-center" />
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground text-2xl">🏀</div>
          <h1 className="text-2xl font-black uppercase tracking-wider">Club Hoops</h1>
          <p className="text-sm text-muted-foreground">Acceso al panel del club</p>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={onForgot} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Recuperar contraseña</h2>
            <div className="space-y-2">
              <Label htmlFor="fe">Email</Label>
              <Input id="fe" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>Enviar enlace</Button>
            <button type="button" onClick={() => setMode("login")} className="block w-full text-xs text-muted-foreground hover:text-foreground">← Volver</button>
          </form>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
                <div className="space-y-2">
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp">Contraseña</Label>
                  <PasswordInput id="lp" value={password} onChange={setPassword} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground">¿Olvidaste tu contraseña?</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignup} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
                <p className="text-xs text-muted-foreground">El registro público crea una cuenta de <span className="font-semibold text-primary">Padre / Tutor</span>. Las cuentas de administrador y entrenador las gestiona el club.</p>
                <div className="space-y-2">
                  <Label htmlFor="sn">Nombre completo</Label>
                  <Input id="sn" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="se">Email</Label>
                  <Input id="se" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sp">Contraseña</Label>
                  <Input id="sp" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Crear cuenta</Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {mode !== "forgot" && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> o <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={onGoogle} disabled={loading}>
              Continuar con Google
            </Button>
          </>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Para probar como administrador, regístrate con <code className="text-primary">admin@club.com</code>.
        </p>
      </div>
    </div>
  );
}
