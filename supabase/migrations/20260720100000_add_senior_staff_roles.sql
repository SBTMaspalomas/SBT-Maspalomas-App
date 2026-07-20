-- Añade los valores 'senior' y 'staff' al enum app_role.
-- Debe ir en su propia migración (transacción independiente) para que los
-- valores queden "committed" antes de poder usarse en migraciones posteriores.
-- Idempotente: IF NOT EXISTS evita error si Lovable ya los creó en la BD viva.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'senior';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
