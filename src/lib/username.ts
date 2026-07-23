// Login unificado email / nombre de usuario.
//
// Supabase Auth solo autentica por email. Las cuentas provisionadas por el club
// (padres/tutores) usan un email SINTÉTICO derivado del nombre de usuario:
// `<usuario>@sbtmaspalomas.local`. El usuario nunca ve ese email; escribe solo su
// nombre de usuario y aquí se reconstruye el email por detrás.
//
// IMPORTANTE: este dominio debe coincidir EXACTAMENTE con SYNTHETIC_DOMAIN en
// supabase/functions/admin-provision-parents/index.ts. Un desajuste rompería el
// login de las cuentas provisionadas de forma silenciosa.
export const SYNTHETIC_EMAIL_DOMAIN = "sbtmaspalomas.local";

/** Un identificador con `@` se trata como email; en caso contrario, como usuario. */
export const isEmailInput = (v: string): boolean => v.includes("@");

/** Convierte lo tecleado en el email con el que autenticar contra Supabase. */
export const toLoginEmail = (v: string): string => {
  const value = v.trim();
  return isEmailInput(value)
    ? value
    : `${value.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
};
