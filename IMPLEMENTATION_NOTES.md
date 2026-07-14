# Implementation Notes - Flujo Obligatorio Post-Registro

## Cambios a implementar:

### 1. Flujo post-registro obligatorio
- En `_authenticated/index.tsx`: antes de mostrar FamilySelector, verificar si el usuario tiene un registro en tabla `registrations`
- Si NO tiene registro → forzar vista "registro" (RegistrationFlow)
- Si SÍ tiene registro → mostrar FamilySelector normalmente

### 2. Selector de equipo en Paso 2 (menores)
- En `RegistrationFlow.tsx`: añadir campo `teamId` al estado de `currentChild` y `children`
- Cargar equipos de Supabase (tabla `teams`) al montar el componente
- Mostrar un Select con los equipos disponibles en el formulario de cada hijo
- Al hacer submit, pasar `team_id` al insert de `players`

### 3. Panel de Familia con equipos y cuotas
- En `FamilySelector.tsx`: mostrar los equipos asignados a cada hijo
- Mostrar cuotas pendientes (de tabla `payments` filtrada por `family_id`)

## Tablas relevantes:
- `registrations` - registros federativos (adultos + menores)
- `teams` - equipos (id, name, category)
- `players` - jugadores (id, family_id, full_name, birth_date, team_id)
- `families_meta` - familias (id, head_profile_id, reference_code)
- `payments` - pagos (family_id, amount, period, paid, player_name)

## Estructura auth:
- auth.role === "family" && !auth.activeProfile → FamilySelector
- auth.role === "family" && auth.activeProfile → panel según perfil
- Nuevo: antes de FamilySelector, verificar si tiene `registrations`
