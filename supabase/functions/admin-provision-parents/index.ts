// =============================================================================
// admin-provision-parents (Edge Function, service_role)
//
// Crea cuentas de padre/tutor (rol `family`) a partir de una lista de jugadores.
// Genera para cada uno un nombre de usuario único y una contraseña temporal, y
// guarda las credenciales en `provisioned_credentials` (tabla admin-only) para
// que el admin las distribuya. Sirve tanto para alta individual como masiva.
//
// El email de Supabase Auth es SINTÉTICO: `<username>@sbtmaspalomas.local`. El
// padre nunca lo ve; entra con su nombre de usuario. El flag
// user_metadata.must_change_password fuerza el cambio de contraseña al entrar.
//
// Seguridad: solo administradores. La autorización se resuelve consultando
// `user_roles` con el cliente service_role (no depende de grants sobre has_role).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Debe coincidir EXACTAMENTE con SYNTHETIC_EMAIL_DOMAIN en src/lib/username.ts.
const SYNTHETIC_DOMAIN = "sbtmaspalomas.local";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ParentInput {
  playerId?: string;
  childName?: string;
  fullName?: string;
  familyId?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Slug ASCII apto para nombre de usuario (minúsculas, sin acentos ni símbolos).
function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
  return base || "familia";
}

function randomPassword(len = 12): string {
  // Sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil de dictar.
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// deno-lint-ignore no-explicit-any
async function uniqueUsername(admin: any, base: string): Promise<string> {
  const root = slugify(base);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? root : `${root}${attempt + 1}`;
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  // Colisión extrema: sufijo aleatorio.
  return `${root}${Math.floor(1000 + Math.random() * 9000)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Identificar al llamante desde su JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "No autenticado" }, 401);
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json({ error: "No autenticado" }, 401);
    const callerId = userData.user.id;

    // 2. Cliente service_role (bypass RLS) + autorización de admin.
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) return json({ error: "Error comprobando permisos" }, 500);
    if (!roleRow) return json({ error: "Solo administradores" }, 403);

    // 3. Entrada.
    const body = await req.json().catch(() => ({}));
    const parents: ParentInput[] = Array.isArray(body?.parents) ? body.parents : [];
    if (parents.length === 0) return json({ error: "No se indicaron jugadores/tutores" }, 400);

    const created: { playerId?: string; childName?: string; username: string; tempPassword: string }[] = [];
    const failed: { playerId?: string; childName?: string; error: string }[] = [];

    // 4. Crear una cuenta por jugador/tutor.
    for (const p of parents) {
      try {
        const childName = (p.childName ?? "").trim();
        const guardianName = (p.fullName ?? "").trim() || (childName ? `Tutor/a de ${childName}` : "Tutor/a");
        const base = childName || guardianName;

        const username = await uniqueUsername(admin, base);
        const tempPassword = randomPassword(12);
        const email = `${username}@${SYNTHETIC_DOMAIN}`;

        // 4a. Crear el usuario de Auth (auto-confirmado, sin envío de correo).
        const { data: createdUser, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            username,
            full_name: guardianName,
            must_change_password: true,
            assigned_role: "family",
          },
        });
        if (cErr || !createdUser?.user) throw new Error(cErr?.message ?? "No se pudo crear el usuario");
        const newUserId = createdUser.user.id;

        // 4b. Asegurar username en el perfil (handle_new_user ya lo intenta desde
        //     la metadata; este update es idempotente y a prueba de fallos).
        await admin.from("profiles").update({ username }).eq("id", newUserId);

        // 4c. Vincular / crear la familia y enganchar al jugador.
        let familyId = p.familyId ?? null;
        if (familyId) {
          await admin.from("families_meta").update({ head_profile_id: newUserId }).eq("id", familyId);
        } else {
          const { data: fam, error: famErr } = await admin
            .from("families_meta")
            .insert({ head_profile_id: newUserId, head_email: email })
            .select("id")
            .single();
          if (famErr || !fam) throw new Error(famErr?.message ?? "No se pudo crear la familia");
          familyId = fam.id;
        }
        if (p.playerId) {
          await admin.from("players").update({ family_id: familyId }).eq("id", p.playerId);
        }

        // 4d. Guardar las credenciales para que el admin las reparta.
        await admin.from("provisioned_credentials").insert({
          user_id: newUserId,
          player_id: p.playerId ?? null,
          family_id: familyId,
          username,
          temp_password: tempPassword,
          child_name: childName || null,
          created_by: callerId,
        });

        created.push({ playerId: p.playerId, childName: childName || undefined, username, tempPassword });
      } catch (e) {
        failed.push({
          playerId: p.playerId,
          childName: p.childName,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return json({ created, failed }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
