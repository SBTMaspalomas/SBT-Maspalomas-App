# Especificación de Producto — SBT Maspalomas App

> Documento técnico-funcional que describe **todo lo implementado** en la aplicación de gestión del club de baloncesto **SBT Maspalomas** ("El Baloncesto en el Sur · Gran Canaria").
>
> Última revisión del código: rama `claude/product-spec-doc-u93sm9`.

---

## 1. Visión general

**SBT Maspalomas App** es una plataforma web móvil-first para la gestión integral de un club de baloncesto. Cubre el ciclo completo de vida de un miembro del club:

1. **Alta y autenticación** de usuarios (registro público de familias, cuentas de admin/entrenador gestionadas por el club).
2. **Registro federativo** obligatorio con subida de documentación y firma digital.
3. **Validación documental** por parte de la administración (aprobación por documento).
4. **Gestión deportiva**: equipos, asignación de jugadores, convocatorias y control de asistencia.
5. **Gestión económica**: cuotas, comprobantes de pago y seguimiento de deuda.
6. **Comunicación**: chats por equipo, familias, difusión y canal privado con administración (en tiempo real).
7. **Consumo de información** por parte de jugadores y familias: jornada, calendario, clasificación, eventos y tablón.

La aplicación usa un modelo de **roles** con vistas y permisos diferenciados, y un patrón de **"perfiles" estilo Netflix** para las cuentas de familia (adulto protegido por PIN + un perfil por cada hijo/a).

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | **React 19** sobre **TanStack Start** (SSR) + **TanStack Router** (file-based routing) |
| Bundler / dev | **Vite 8**, configuración envuelta por `@lovable.dev/vite-tanstack-config` |
| Estilos | **Tailwind CSS 4** (`@tailwindcss/vite`) + `tw-animate-css` |
| Componentes UI | **shadcn/ui** (estilo *new-york*), primitivas **Radix UI**, iconos **lucide-react** |
| Estado servidor | **@tanstack/react-query** |
| Estado cliente (demo) | Store propio con `useSyncExternalStore` + `localStorage` (`src/lib/clubStore.ts`) |
| Backend / BaaS | **Supabase** (PostgreSQL, Auth, Storage, Realtime) |
| Auth OAuth | **Google** vía `@lovable.dev/cloud-auth-js` |
| Validación | **zod**, **react-hook-form**, `@hookform/resolvers` |
| Utilidades | `date-fns`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner` (toasts) |
| Runtime de build | **Nitro** (target Cloudflare por defecto); el README menciona despliegue en **Vercel** |
| Gestor de paquetes | Soporta **bun**, **pnpm** y **npm** (lockfiles presentes) |

### Variables de entorno

```
VITE_SUPABASE_URL=https://kiifznmcpyvalupdtnrq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

El cliente Supabase (`src/integrations/supabase/client.ts`) se instancia de forma perezosa (Proxy) y soporta tanto claves JWT clásicas como las nuevas claves opacas (`sb_publishable_...`), ajustando las cabeceras `apikey`/`Authorization`.

---

## 3. Identidad visual y tema

- **Marca**: SBT Maspalomas, rojo corporativo **#cc0033**.
- **Tema oscuro** por defecto, definido con variables CSS en espacio de color **OKLCH** (`src/styles.css`).
- Tokens de diseño: `background`, `surface`, `surface-elevated`, `primary` (rojo), `success`, `warning`, `destructive`, etc.
- Tipografía display sugerida: *Bebas Neue / Oswald*.
- Logo servido desde Supabase Storage (bucket público `avatars`).
- Toasts con `sonner` en tema oscuro, posición `top-center`.

---

## 4. Arquitectura de rutas

Enrutado basado en ficheros (TanStack Router). Árbol generado en `src/routeTree.gen.ts`.

| Ruta | Fichero | Descripción |
|------|---------|-------------|
| `/` (raíz shell) | `src/routes/__root.tsx` | Shell HTML, `QueryClientProvider`, `AuthProvider`, boundaries de error/404, metadatos. |
| `/auth` | `src/routes/auth.tsx` | Login / registro / recuperación de contraseña / Google OAuth. |
| `/reset-password` | `src/routes/reset-password.tsx` | Establecer nueva contraseña tras enlace de recuperación. |
| `/_authenticated` | `src/routes/_authenticated/route.tsx` | Layout protegido. `beforeLoad` verifica sesión con `supabase.auth.getUser()`; si no hay usuario → redirige a `/auth`. `ssr: false`. |
| `/_authenticated/` | `src/routes/_authenticated/index.tsx` | **Aplicación principal** (`ClubApp`): cabecera, navegación por rol y renderizado de la vista activa. |

### Infraestructura de servidor / errores

- `src/server.ts`: entrada SSR personalizada (envoltura de errores).
- `src/integrations/supabase/auth-middleware.ts`: middleware `requireSupabaseAuth` para funciones de servidor que valida el token Bearer (`getClaims`) — infraestructura preparada aunque el grueso de la app opera cliente-directo contra Supabase con RLS.
- `src/lib/error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts`: captura y reporte de errores a la plataforma Lovable.

---

## 5. Modelo de autenticación y roles

### 5.1 Roles (`app_role` enum)

`admin` · `coach` · `parent` · `player` · `family`

El registro público crea siempre cuentas de rol **family** (padres/tutores); las cuentas de **admin** y **coach** las gestiona el club. Hay bootstrap automático a `admin` para los emails `admin@club.com` / `admin@club.es` (trigger `handle_new_user`).

### 5.2 `AuthProvider` (`src/lib/auth-context.tsx`)

Contexto central que expone: `session`, `user`, `role`, `fullName`, `family`, `activeProfile`, `loading` y acciones `selectAdult(pin)`, `selectChild(id)`, `clearProfile()`, `signOut()`.

Al iniciar sesión:
1. `loadRoleAndProfile()` — lee `user_roles`, `profiles` y `coach_teams` en paralelo. Prioriza rol: **admin > coach > parent > player > family**.
2. Si el rol es `family`, `loadFamily()` carga `families_meta` (código de referencia, PIN) y los `players` (hijos/as) vinculados.
3. Puente al *demo store*: mapea el rol real a un usuario demo para que las vistas heredadas sigan funcionando.

### 5.3 Perfiles de familia (estilo Netflix)

Las cuentas `family` **no** entran directamente al panel: primero eligen un **perfil**:
- **Adultos Responsables** → protegido por **PIN de 4 dígitos** (`adult_pin` de la familia, con fallback demo `1234`).
- **Un perfil por cada hijo/a** → se comporta como rol `player` (vista `PlayerView`).

`activeProfile` puede ser `{ kind: "adult" }` o `{ kind: "child", childId }`. El botón "Cambiar de perfil" limpia la selección.

### 5.4 Flujo de la pantalla `/auth`

- **Entrar**: email + contraseña (`signInWithPassword`), con toggle de visibilidad de contraseña.
- **Registrarse**: nombre completo + email + contraseña (mín. 8 caracteres). Auto-confirmación activa → sesión inmediata.
- **¿Olvidaste tu contraseña?**: `resetPasswordForEmail` → enlace a `/reset-password`.
- **Continuar con Google**: OAuth vía SDK de Lovable Cloud.

---

## 6. Aplicación principal (`ClubApp`)

`src/routes/_authenticated/index.tsx` orquesta toda la experiencia autenticada.

### 6.1 Gate de registro federativo obligatorio

Para roles `family` / `parent`, al entrar se consulta la tabla `registrations` (tipo `adult`). Si el usuario **no** tiene registro de adulto → se le fuerza a completar el **`RegistrationFlow`** antes de acceder a cualquier panel. Admins y coaches quedan exentos.

### 6.2 Navegación por rol

Menú lateral filtrado según el rol efectivo (un perfil hijo se trata como `player`):

| Vista | admin | coach | parent | player | family |
|-------|:---:|:---:|:---:|:---:|:---:|
| Inicio | ✔ | ✔ | ✔ | ✔ | ✔ |
| Mi zona (PlayerView) | | | | ✔ | |
| Cartelera | ✔ | ✔ | ✔ | | ✔ |
| Registro federativo | ✔ | | ✔ | | ✔ |
| Miembros (RoleManager) | ✔ | | | | |
| Equipos (TeamsManager) | ✔ | | | | |
| Asignar Equipos | ✔ | | | | |
| Convocatorias | ✔ | ✔ | | | |
| Mis Convocatorias | | | | ✔ | |
| Validación docs. | ✔ | | | | |
| Cuotas y pagos | ✔ | | ✔ | | ✔ |
| Control de asistencia | | ✔ | | | |
| Chats | ✔ | ✔ | ✔ | ✔ | ✔ |

### 6.3 Cabecera y `Home`

- Cabecera con logo, nombre del club, ficha del usuario/perfil activo (iniciales o avatar), botones de **cambiar perfil**, **reiniciar datos demo** y **cerrar sesión**.
- `Home` muestra bienvenida contextual por rol. Para admins, tarjetas de estadísticas (jugadores, aprobados, pendientes, pagos pendientes). Accesos rápidos ("Próximos partidos", "Chats", "Validar documentos", etc.).
- El panel de **Adultos Responsables** muestra el identificador de la cuenta (`reference_code`).

---

## 7. Módulos funcionales

### 7.1 Registro federativo — `RegistrationFlow.tsx`

Asistente multi-paso con firma digital y subida de documentación:

- **Paso 1 — Datos personales del adulto**: nombre, apellidos, tipo (DNI/Pasaporte) y nº de documento, fecha de nacimiento, teléfono, email, y checkbox *"Soy adulto responsable de un menor"*.
- **Paso 2 — Menores a cargo** (si es responsable): alta de uno o varios hijos (nombre, apellidos, fecha de nacimiento, documento y **selección de equipo** desde `teams`). Lista editable con opción de eliminar.
- **Paso 3 — Documentación y autorizaciones**:
  - Foto carnet, DNI anverso y DNI reverso (subida a Storage bucket `player-docs`).
  - **Autorizaciones**: derechos de imagen, traslados en vehículos privados, asistencia médica de emergencia (para menores) y **autorización obligatoria de cesión de datos** a federaciones/seguros/etc.
  - **Firma digital** del adulto (componente `SignaturePad`).

Al enviar:
1. *Upsert* del perfil (`profiles`).
2. Creación de `families_meta` si es responsable con hijos.
3. Subida de archivos a Storage y obtención de URLs públicas.
4. Inserción del registro del **adulto** en `registrations` (`type: 'adult'`, `doc_status: 'pending'`).
5. Inserción de cada **menor** en `registrations` (`type: 'minor'`, con `parent_registration_id`) **y** en `players` (con `team_id`).
6. Generación automática del **identificador de cuenta**: `Apellido.Inicial-NN` (secuencia incremental buscando prefijos existentes; ej. `Perez.L-01`).

**Firma digital — `SignaturePad.tsx`**: canvas 600×200 con captura por puntero (dedo/ratón), exporta PNG en data-URL, botón de borrado.

### 7.2 Validación documental — `ValidationConsole.tsx` (solo admin)

Consola de revisión de todos los `registrations`:
- Filtros por estado: **todos / pendientes / aprobados / rechazados**, con contadores.
- Lista de registros (adulto/menor) con estado global calculado.
- **Aprobación granular por documento**: foto, DNI anverso, DNI reverso y firma tienen estado propio (`photo_status`, `dni_front_status`, `dni_back_status`, `signature_status`). El estado global se deriva: *rechazado* si alguno lo está, *aprobado* si todos lo están, si no *pendiente*.
- Vista previa de imágenes con enlace de descarga.
- Botones de aprobar/rechazar por documento, campo de **motivo de rechazo**, y acción **"Aprobar todos"**.
- Muestra el estado de las autorizaciones firmadas.

### 7.3 Gestión de pagos — `Payments.tsx`

Dos vistas según rol:

**`PaymentsAdmin`** (admin):
- **Configuración de cuotas** (`FeeSchedulesEditor` en `CuotaAnual.tsx`): editor de los importes y fechas límite de cada tipo de cuota (**Senior / Federado / Escuela**). Los valores se guardan en la tabla `fee_schedules` (upsert por `fee_type`); **no están hardcodeados**. Muestra el total a plazos calculado en vivo.
- Estadísticas (total / pendientes / pagados / rechazados) y resumen de importes (total y pagado en €).
- Lista de pagos (`payments`) cruzada con `players` y `teams`.
- Diálogo de detalle con comprobante y acciones para marcar el pago como **pendiente / pagado / rechazado** (registra `paid_at`).

**`PaymentsParent`** (parent/family):
- **Tarjeta informativa "Cuota anual"** (`CuotaAnual.tsx`) al inicio del panel: muestra el esquema de importes y fechas límite (pago único en septiembre o tres plazos septiembre/noviembre/febrero) según el tipo de cuota —**Senior / Federado / Escuela**— del equipo principal de cada hijo/a. Los importes se leen de `fee_schedules` (hook `useFeeSchedules`, con respaldo a valores por defecto si la tabla no está disponible). Solo se presentan las cuotas de los equipos de los hijos/as (dedup por tipo); a un adulto sin hijos con equipo no se le muestra ninguna referencia. El tipo se deriva de la categoría del equipo con `feeTypeForCategory`.
- Resumen "Al día" vs. pendientes y **deuda pendiente** calculada.
- Tarjetas de importe (total / pagado / pendiente).
- Lista de cuotas de la familia (`payments` filtrado por `family_id`).
- **Subida de comprobante** por cuota pendiente (a Storage `player-docs/payments/...`) y visualización del comprobante subido.

Importes iniciales (semilla de `fee_schedules`, editables por el administrador):

| | Senior | Federado | Escuela |
|---|---|---|---|
| Pago único (15 Sep) | 120€ | 390€ | 245€ |
| Tres pagos (15 Sep) | 50€ | 175€ | 100€ |
| Tres pagos (15 Nov) | 50€ | 125€ | 90€ |
| Tres pagos (15 Feb) | 50€ | 125€ | 90€ |
| **Total a plazos** | **150€** | **425€** | **280€** |

El pago único aplica un descuento sobre el total a plazos (Senior −30€, Federado −35€, Escuela −35€).

### 7.4 Equipos — `TeamsManager.tsx` (solo admin)

CRUD de equipos (`teams`): crear, editar y eliminar (nombre + categoría). Cada tarjeta muestra el recuento de jugadores y un preview de hasta 3 nombres.

### 7.5 Asignación de jugadores a equipos — `PlayerTeamAssignment.tsx` (solo admin)

- Lista de todos los `players` con su equipo oficial.
- Aviso destacado de jugadores **sin equipo asignado**.
- Diálogo para asignar/remover equipo por jugador (actualiza `players.team_id`).

### 7.6 Gestión de miembros y roles — `RoleManager.tsx` (solo admin)

Panel de administración de usuarios registrados:
- Carga combinada de `profiles`, `user_roles`, `coach_teams`, `teams`, `players` y `families_meta`.
- Búsqueda por nombre/email y **filtro por rol**.
- **Cambio de rol** de cualquier usuario (borra roles previos e inserta el nuevo; si deja de ser coach, limpia `coach_teams`).
- Para **entrenadores**: asignación de equipos mediante *toggles* (`coach_teams`).
- Para **familias**: vinculación/desvinculación de hijos (`players.family_id`), creación automática de la ficha de familia al vincular, muestra del `reference_code` y acceso directo al **chat privado** con esa familia (evento `open-private-chat`).

### 7.7 Convocatorias — `ConvocatoriesManager.tsx` (admin/coach) y `ConvocatoriesPlayer.tsx` (player)

**Manager**: creación de convocatorias (`convocatorias`) de tipo **entrenamiento** o **partido**, con equipo, fecha, hora, lugar y notas. Lista con estadísticas de respuestas (confirmados / con problemas / pendientes) y borrado.

**Player**: lista de convocatorias con opción de **confirmar asistencia** o **reportar un problema** (llegaré tarde / no puedo asistir / lesión / otro, con notas). Las respuestas se guardan en `convocatoria_responses`.

> ⚠️ *Nota técnica*: en estos componentes los identificadores `created_by` y `player_id` están cableados como placeholders (`"current_user_id"` / `"current_player_id"`) pendientes de integrar con el contexto de auth.

### 7.8 Control de asistencia — `Attendance.tsx` (solo coach)

- Selector de equipo (los equipos vienen de `coach_teams`; el admin ve todos) y selector de fecha (no permite fechas futuras).
- Por jugador del equipo: marcar **Asiste / Retraso / Falta**. En caso de falta, motivo **justificada / injustificada**.
- Resumen mensual de **retrasos / presencias / ausencias** por jugador.

> ⚠️ *Nota técnica*: la asistencia se persiste en **`localStorage`** (`attendance_v2`), aún no en Supabase.

### 7.9 Vista de jugador/familia — `PlayerView.tsx`

Panel del jugador (o del perfil hijo seleccionado) con pestañas:
- **Jornada**: próximo partido con hora, local/visitante y enlace a Google Maps si es fuera.
- **Calendario**: listado de partidos ordenados.
- **Clasificación**: tabla desde `standings` (posición, G, P, Pts).
- **Eventos**: desde `club_events` (torneos, campus, etc.).
- **Tablón**: anuncios.
- **Galería** y **Stats**: marcadas como *"Próximamente"*.

### 7.10 Selector de familia — `FamilySelector.tsx`

- Pantalla "¿Quién está viendo?" con el código de cuenta.
- Tile de **Adultos Responsables** (abre teclado de **PIN OTP** de 4 dígitos).
- Un tile por hijo/a, con avatar personalizable (`AvatarUpload`), equipo y edad calculada.
- Bloques de resumen: **Equipos** de los hijos y **Plan semanal** (agenda de partidos próximos).

### 7.11 Avatares — `AvatarUpload.tsx`

Subida de avatar para jugadores o perfiles: validación de tipo (JPG/PNG/WebP) y tamaño (máx. 2 MB), previsualización, subida a Storage `player-docs/avatars/...` y actualización de `players.avatar_url` o `profiles.avatar_url`.

### 7.12 Chats — `Chats.tsx`

Mensajería en **tiempo real** (Supabase Realtime) con cuatro tipos de canal:

- **`team`** — chat del equipo (jugadores + staff), oculto para categorías **U12**.
- **`family`** — chat de familias de un equipo (adultos responsables + staff).
- **`broadcast`** — canal de difusión del club (escritura solo admin/coach).
- **`private`** — conversación privada 1-a-1 entre **administración y una familia** (solo visible en el perfil de Adultos Responsables).

La construcción de la lista de canales depende del rol:
- **Admin**: canal de equipo y de familias por cada equipo, difusión, y un canal privado por familia.
- **Coach**: canales de sus equipos asignados + difusión.
- **Family**: canal de familias por equipo de cada hijo, difusión (solo lectura) y canal privado con administración; el perfil hijo solo ve el chat de equipo si **no** es U12.
- **Player**: chat de su equipo si no es U12.

Reglas de acceso reforzadas en base de datos (RLS + función `user_can_access_team_channel`). Marca de leídos en mensajes privados. Escucha el evento `open-private-chat` para saltar a la conversación con una familia concreta.

### 7.13 Cartelera / Tablón

- **`NewsBoard.tsx`**: pantalla de bienvenida del tablón general — actualmente **placeholder** ("Próximamente").
- **`Board.tsx`**: componente más completo (jornada / información con PDFs / tablón con publicación de anuncios por admin/coach) que opera sobre el *demo store*. No está enlazado en la navegación actual (queda como base para la cartelera definitiva).

### 7.14 `PlayersList.tsx`

Listado de jugadores con estadísticas de estado documental y búsqueda. Opera sobre el *demo store*; no está enlazado en la navegación actual.

---

## 8. Capa de datos (Supabase)

### 8.1 Store de demo (`clubStore.ts` + `use-club-data.tsx`)

Existe un store cliente en `localStorage` (`club_state_v1`) con tipos heredados (`Team`, `Player`, `Match`, `Announcement`, etc.). El hook `useClubData` hidrata parcialmente este store desde Supabase (`teams`, `players`, `club_events`) y se suscribe a cambios en tiempo real. Sirve de **puente de compatibilidad** para las vistas heredadas (PlayerView, Board, FamilyAgenda) mientras la migración a Supabase se completa.

### 8.2 Esquema PostgreSQL (migraciones `supabase/migrations/`)

Tablas con **Row Level Security (RLS)** activada:

| Tabla | Propósito | Notas de acceso |
|-------|-----------|-----------------|
| `profiles` | Perfil de usuario (email, nombre, avatar, teléfono) | Lectura/edición propia; admin lee todos |
| `user_roles` | Roles por usuario (enum `app_role`) | Lectura propia; admin gestiona todos |
| `coach_teams` | Equipos asignados a un entrenador | Admin gestiona; coach lee lo suyo |
| `teams` | Equipos (nombre, categoría, `age_category`) | Lectura para autenticados; admin gestiona |
| `players` | Jugadores (nombre, fecha nac., `team_id`, `family_id`, avatar) | Familia lee sus hijos; coach lee todos; admin gestiona |
| `families_meta` | Ficha de familia (head, email, `reference_code`, `adult_pin`) | Familia lee/gestiona la suya; admin todo |
| `standings` | Clasificación por equipo | Lectura autenticados; admin gestiona |
| `club_events` | Eventos del club (torneos, campus…) | Lectura autenticados; admin gestiona |
| `team_messages` | Mensajes de canales team/family/broadcast | Controlado por `user_can_access_team_channel` |
| `private_messages` | Mensajes privados admin↔familia | Solo admin y familia receptora |
| `registrations`* | Registros federativos (adulto/menor, docs, autorizaciones, estados por documento) | Usado por RegistrationFlow y ValidationConsole |
| `payments`* | Cuotas y pagos (importe, periodo, estado, comprobante) | Admin gestiona; familia ve los suyos |
| `fee_schedules` | Importes y fechas límite de cada tipo de cuota (senior/federado/escuela) | Admin edita; todos leen |
| `convocatorias`* | Convocatorias de entreno/partido | Manager/Player |
| `convocatoria_responses`* | Respuestas de jugadores a convocatorias | Manager/Player |

\* Tablas referenciadas en el código pero **no presentes en los tipos generados** (`src/integrations/supabase/types.ts`) ni en las migraciones incluidas en el repositorio — ver §10.

**Funciones y triggers relevantes**:
- `handle_new_user()` — crea `profiles` + rol por defecto (`family`, o `admin` para emails bootstrap) y auto-vincula familias por email.
- `has_role(user, role)` — helper `SECURITY DEFINER` usado en las políticas RLS.
- `compute_family_reference_code()` + trigger `refresh_family_reference_code` — genera el código de familia a partir del hijo mayor.
- `derive_age_category()` — deriva `U12` / `U14+` a partir de la categoría del equipo.
- `user_can_access_team_channel()` — autoriza acceso a canales de chat (incluye la regla de que los menores U12 no tienen chat de equipo).
- `update_updated_at_column()` — mantiene `updated_at`.

### 8.3 Storage

- Bucket público **`avatars`** (logo del club, avatares).
- Bucket **`player-docs`** (documentación de registro, comprobantes de pago, avatares subidos).

### 8.4 Realtime

Publicación `supabase_realtime` incluye `team_messages` y `private_messages`. `useClubData` también se suscribe a cambios de esquema para refrescar el store demo.

---

## 9. Reglas de negocio destacadas

- **Registro obligatorio**: sin registro federativo de adulto, la familia no accede al panel.
- **Identificador de cuenta** autogenerado `Apellido.Inicial-NN` (p. ej. `Perez.L-01`).
- **Categoría U12**: los menores de categoría U12 **no** tienen chat de equipo; su comunicación pasa por el chat de familias con los adultos responsables (aplicado tanto en UI como en RLS).
- **Prioridad de roles**: admin > coach > parent > player > family.
- **Aprobación documental granular**: cada documento del registro se aprueba/rechaza por separado y el estado global se deriva.
- **PIN de adulto** configurable por familia (`adult_pin`), con fallback demo `1234`.
- **Canal de difusión**: solo escriben admin/coach; las familias lo tienen en modo lectura.

---

## 10. Estado del desarrollo, deuda técnica y pendientes

**Implementado y funcional** (contra Supabase): autenticación, registro federativo, validación documental, gestión de equipos, asignación de jugadores, gestión de miembros/roles, pagos (admin y familia), chats en tiempo real (team/family/broadcast/privado), selector de familia con PIN, avatares.

**Puntos de atención / deuda técnica**:
1. **Tipos desincronizados**: `registrations`, `payments`, `convocatorias` y `convocatoria_responses` se usan en el código pero no aparecen en `types.ts` ni en las migraciones versionadas del repo (se accede a algunas con `as any` / `"tabla" as any`). Conviene regenerar los tipos y versionar sus migraciones.
2. **Convocatorias con placeholders**: `created_by` y `player_id` están cableados (`"current_user_id"`, `"current_player_id"`) — falta integrarlos con `useAuth`.
3. **Asistencia en localStorage**: `Attendance.tsx` no persiste en base de datos todavía.
4. **Datos demo**: partidos (`matches`), anuncios y parte de la agenda provienen del *demo store* en `localStorage`, no de Supabase.
5. **Secciones "Próximamente"**: Galería y Stats en `PlayerView`, y `NewsBoard` (tablón general).
6. **Componentes no enlazados**: `Board.tsx` y `PlayersList.tsx` existen como base pero no están en la navegación actual.
7. El botón *"Reiniciar datos demo"* en la cabecera resetea el store local (utilidad de desarrollo).

### Fases (según README)

- ✅ Fase 1: Conexión a Supabase
- ✅ Fase 2: Registro de jugadores
- ✅ Fase 3: Subida de documentos a Storage
- 🔄 Fase 4: Gestión deportiva (partidos, asistencia)
- ⏳ Fase 5: Comunicaciones en tiempo real *(los chats ya están operativos; pendiente pulir cartelera/tablón)*
- ⏳ Fase 6: Gestión de pagos *(ya hay flujo admin/familia implementado)*

---

## 11. Scripts y desarrollo

```bash
npm install       # o bun install / pnpm install
npm run dev       # servidor de desarrollo (vite dev)
npm run build     # build de producción
npm run build:dev # build en modo development
npm run preview   # previsualización del build
npm run lint      # ESLint
npm run format    # Prettier
```

Configuración de linting en `eslint.config.js` (con `eslint-plugin-react-hooks`, `react-refresh`, `prettier`). Alias `@` → `src/` gestionado por `vite-tsconfig-paths`.

---

## 12. Estructura del proyecto (resumen)

```
src/
├── routes/                    # Rutas (TanStack Router, file-based)
│   ├── __root.tsx             # Shell + providers + error boundaries
│   ├── auth.tsx               # Login/registro/recuperación/Google
│   ├── reset-password.tsx
│   └── _authenticated/
│       ├── route.tsx          # Guard de sesión
│       └── index.tsx          # ClubApp (app principal)
├── components/
│   ├── club/                  # Módulos de dominio (17 componentes)
│   │   ├── RegistrationFlow.tsx   ValidationConsole.tsx
│   │   ├── Payments.tsx           Chats.tsx
│   │   ├── TeamsManager.tsx       PlayerTeamAssignment.tsx
│   │   ├── RoleManager.tsx        Attendance.tsx
│   │   ├── ConvocatoriesManager.tsx  ConvocatoriesPlayer.tsx
│   │   ├── PlayerView.tsx         FamilySelector.tsx
│   │   ├── AvatarUpload.tsx       SignaturePad.tsx
│   │   ├── NewsBoard.tsx          Board.tsx  PlayersList.tsx
│   └── ui/                    # shadcn/ui (primitivas)
├── lib/
│   ├── auth-context.tsx       # AuthProvider + perfiles de familia
│   ├── clubStore.ts           # Store demo (localStorage)
│   └── utils.ts, error-*.ts
├── hooks/
│   ├── use-club-data.tsx      # Hidratación del store desde Supabase
│   └── use-mobile.tsx
├── integrations/
│   ├── supabase/              # client, middleware, types
│   └── lovable/               # OAuth Google
├── styles.css                 # Tema (OKLCH, rojo #cc0033)
└── server.ts, start.ts, router.tsx

supabase/migrations/           # Esquema, RLS, triggers, funciones, seeds
```

---

*Documento generado a partir del análisis del código fuente de la rama `claude/product-spec-doc-u93sm9`.*
