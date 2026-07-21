# Especificación de Producto — SBT Maspalomas App

> Documento técnico-funcional que describe **todo lo implementado** en la aplicación de gestión del club de baloncesto **SBT Maspalomas** ("El Baloncesto en el Sur · Gran Canaria").
>
> Última revisión del código: **2026-07-21** (rama `claude/fase-1-crear-partidos-oamzjo`). Incorpora los chats por rol (Admin/Entrenadores/Staff) y su gestión por el administrador, los tipos de usuario adulto en el registro (Responsable/Senior/Entrenador/Staff), el soporte multi-equipo (`player_teams`), las cuotas editables y el **saneamiento de la Fase 0**. Añade las **Fases 2-5** del roadmap: convocatorias completas (mínimo federativo, roster con estado en vivo y "doblar" jugadores), **asistencia persistida en Supabase**, **Ficha Federativa PDF** integrada en el semáforo del validador, y **dorsales blindados por equipo + tallas de equipación** condicionales al nivel del equipo. Incorpora además la **Fase 1 · Calendario/Partidos** (Módulo 6): tabla `matches` con RLS, creación manual de partidos (admin/coach), importación de Excel deshabilitada, y visualización real de jornada/calendario para todos los roles.
>
> El plan de lo que **falta** por construir frente al plan de inicio del proyecto vive en un documento aparte, [`ROADMAP.md`](./ROADMAP.md).

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

`admin` · `coach` · `parent` · `player` · `family` · `senior` · `staff`

Los valores `senior` y `staff` se añadieron en migración propia (`20260720100000_add_senior_staff_roles.sql`, con `ADD VALUE IF NOT EXISTS`). En la práctica la tabla `user_roles` solo admite cinco de ellos por `CHECK`: **`admin`, `coach`, `family`, `senior`, `staff`** (`parent`/`player` existen en el enum como legado pero no se asignan hoy).

- **`family`** — Adulto responsable de uno o varios menores (rol del registro público por defecto).
- **`senior`** — Jugador adulto (+18) que se registra a sí mismo; crea su propia ficha en `players` (`players.user_id`).
- **`coach`** — Entrenador (equipos vía `coach_teams`).
- **`staff`** — Otras funciones del club (delegados, directiva…).
- **`admin`** — Administración del club.

Las cuentas de **admin** y **coach** las gestiona el club; el resto se autoasignan en el registro. Hay bootstrap automático a `admin` para los emails `admin@club.com` / `admin@club.es` (trigger `handle_new_user`).

### 5.2 `AuthProvider` (`src/lib/auth-context.tsx`)

Contexto central que expone: `session`, `user`, `role` (rol principal), `roles` (todos los roles del usuario), `fullName`, `family`, `activeProfile`, `selfPlayerId` (ficha propia del jugador Senior) y `loading`; y las acciones `selectAdult(pin)`, `selectChild(id)`, `clearProfile()`, `signOut()`.

Al iniciar sesión:
1. `loadRoleAndProfile()` — lee `user_roles`, `profiles` y `coach_teams` en paralelo. Un usuario puede tener **varios roles**; el rol principal se elige por prioridad: **admin > coach > family > senior > staff > parent > player** (el *responsable* manda sobre *senior*/*staff* cuando coexisten, para que un adulto que además juega entre por el flujo de familia).
2. Si el rol es `family`, `loadFamily()` carga `families_meta` (código de referencia, PIN) y los `players` (hijos/as) vinculados.
3. Si entre sus roles está `senior`, resuelve su **ficha de jugador propia** (`players.user_id = auth.uid()`) y la expone como `selfPlayerId` para cuotas, equipos y convocatorias.
4. Puente al *demo store*: mapea el rol real a un usuario demo para que las vistas heredadas sigan funcionando (`senior`→jugador, `staff`→coach demo).

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

Menú lateral filtrado según el rol efectivo (un perfil hijo se trata como `player`). Desde la vista de **Equipos** el admin accede además a la **asignación de jugadores a equipos** (fusionada dentro del panel de Equipos) y al **gestor de chats** (`ChatsManager`, §7.15):

| Vista | admin | coach | parent | player | family |
|-------|:---:|:---:|:---:|:---:|:---:|
| Inicio | ✔ | ✔ | ✔ | ✔ | ✔ |
| Mi zona (PlayerView) | | | | ✔ | |
| Cartelera | ✔ | ✔ | ✔ | | ✔ |
| Partidos (MatchesManager) | ✔ | ✔ | ✔ | | ✔ |
| Registro federativo | ✔ | | ✔ | | ✔ |
| Miembros (RoleManager) | ✔ | | | | |
| Equipos (TeamsManager) | ✔ | | | | |
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

- **Paso 1 — Datos personales del adulto**: nombre, apellidos, tipo (DNI/Pasaporte) y nº de documento, fecha de nacimiento, teléfono, email, y un **selector de tipo de usuario** que determina el rol y el flujo:
  - **Adulto responsable de un menor** → rol `family` (ve la sección de hijos, documentos de menores y PIN de adulto).
  - **Jugador Senior (+18)** → rol `senior`: se registra como jugador de sí mismo, ve su cuota y sus convocatorias; no gestiona hijos.
  - **Entrenador** → rol `coach`. **Staff / otras funciones** → rol `staff`. Ni entrenador ni staff ven cuotas ni sección de menores.
  Los no responsables no llevan PIN y se identifican por nombre + apellido.
- **Paso 2 — Menores a cargo** (solo tipo responsable): alta de uno o varios hijos (nombre, apellidos, fecha de nacimiento, documento y **selección de equipo** desde `teams`). Lista editable con opción de eliminar.
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
6. Si el tipo es **Senior**, creación de su **propia ficha de jugador** en `players` vinculada por `players.user_id` (para cuotas/equipos/convocatorias).
7. Fijación del **rol principal** según el tipo elegido mediante la RPC `set_self_registration_role` (`SECURITY DEFINER`).
8. Generación automática del **identificador de cuenta**: `Apellido.Inicial-NN` (secuencia incremental buscando prefijos existentes; ej. `Perez.L-01`).

**Firma digital — `SignaturePad.tsx`**: canvas 600×200 con captura por puntero (dedo/ratón), exporta PNG en data-URL, botón de borrado.

### 7.2 Validación documental — `ValidationConsole.tsx` (solo admin)

Consola de revisión de todos los `registrations`:
- Filtros por estado: **todos / pendientes / aprobados / rechazados**, con contadores.
- Lista de registros (adulto/menor) con estado global calculado.
- **Aprobación granular por documento**: foto, DNI anverso, DNI reverso, firma y **Ficha Federativa** tienen estado propio (`photo_status`, `dni_front_status`, `dni_back_status`, `signature_status`, `federativa_status`). El estado global se deriva: *rechazado* si alguno lo está, *aprobado* si todos lo están, si no *pendiente*. La **Ficha Federativa** solo cuenta para el estado global cuando ya se ha subido el PDF (`federativa_pdf_url` no nulo); mientras no se aporte no bloquea la validación del resto.
- Vista previa de imágenes con enlace de descarga; la Ficha Federativa, al ser PDF, se muestra como tarjeta con enlace **"Abrir PDF"** (no se previsualiza como imagen).
- Botones de aprobar/rechazar por documento, campo de **motivo de rechazo**, y acción **"Aprobar todos"** (que aprueba también la ficha federativa si hay PDF subido).
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

CRUD de equipos (`teams`): crear, editar y eliminar (nombre + categoría). Cada tarjeta muestra el recuento de jugadores y un preview de hasta 3 nombres. Desde este panel el admin también accede, mediante botones de cabecera, a la **asignación de jugadores a equipos** (§7.5, ya no es una entrada de menú independiente) y a **"Gestionar chats"**, que abre el `ChatsManager` (§7.15).

### 7.5 Asignación de jugadores a equipos — `PlayerTeamAssignment.tsx` (solo admin)

- Lista de todos los `players` con su equipo oficial.
- Aviso destacado de jugadores **sin equipo asignado**.
- Diálogo para asignar/remover equipo por jugador (actualiza `players.team_id`).
- En cada badge de equipo se muestra el **dorsal** asignado (`#N`) cuando existe, leído de `player_teams.dorsal` (ver §7.17).

### 7.6 Gestión de miembros y roles — `RoleManager.tsx` (solo admin)

Panel de administración de usuarios registrados:
- Carga combinada de `profiles`, `user_roles`, `coach_teams`, `teams`, `players` y `families_meta`.
- Búsqueda por nombre/email y **filtro por rol**.
- **Cambio de rol** de cualquier usuario (borra roles previos e inserta el nuevo; si deja de ser coach, limpia `coach_teams`).
- Para **entrenadores**: asignación de equipos mediante *toggles* (`coach_teams`).
- Para **familias**: vinculación/desvinculación de hijos (`players.family_id`), creación automática de la ficha de familia al vincular, muestra del `reference_code` y acceso directo al **chat privado** con esa familia (evento `open-private-chat`).

### 7.7 Convocatorias — `ConvocatoriesManager.tsx` (admin/coach) y `ConvocatoriesPlayer.tsx` (player)

**Manager**: creación de convocatorias (`convocatorias`) de tipo **entrenamiento** o **partido**, con equipo, fecha, hora, lugar, notas y **mínimo de jugadores exigido en acta** (`min_players`, opcional). Cada tarjeta muestra el **roster** (jugadores del equipo, resuelto por `players.team_id` y `player_teams`) con el **contador de confirmados** `X / mínimo`, que se pinta en **rojo** cuando no se alcanza el mínimo federativo. Un diálogo de **detalle** lista jugador a jugador su estado (confirmado / problema / pendiente) y permite:
- **"Doblar"** jugadores de otras categorías autorizados a jugar con el equipo (se guardan en `convocatoria_extra_players`; aparecen en el roster con la etiqueta *Doblado* y pueden retirarse).
- **Refresco en vivo** de respuestas y doblados mediante **Supabase Realtime** (canal suscrito a `convocatoria_responses` y `convocatoria_extra_players` filtrados por la convocatoria abierta).

**Player**: lista **filtrada** a las convocatorias que le corresponden — las de su(s) equipo(s) (por `players.team_id` o `player_teams`) o aquellas en las que le han **doblado** (`convocatoria_extra_players`) — con opción de **confirmar asistencia** o **reportar un problema** (llegaré tarde / no puedo asistir / lesión / otro, con notas). Las respuestas se guardan en `convocatoria_responses`.

Los identificadores se integran con el contexto de auth: `convocatorias.created_by` toma `user.id` del `useAuth`, y `convocatoria_responses.player_id` el jugador del perfil activo (el `childId` del perfil hijo o el `selfPlayerId` del jugador Senior).

### 7.8 Control de asistencia — `Attendance.tsx` (solo coach)

- Selector de equipo (los equipos vienen de `coach_teams`; el admin ve todos) y selector de fecha (no permite fechas futuras).
- Por jugador del equipo: marcar **Asiste / Retraso / Falta**. En caso de falta, motivo **justificada / injustificada**.
- Resumen mensual de **retrasos / presencias / ausencias** por jugador.
- **Persistencia en Supabase** (tabla `attendance`): la marca se guarda con **upsert** por `(player_id, team_id, date)` de forma optimista (con reversión si falla) y firma `recorded_by = auth.uid()`. Al cambiar de equipo se recarga su histórico completo, sobre el que se calcula el resumen mensual.

### 7.9 Vista de jugador/familia — `PlayerView.tsx`

Panel del jugador (o del perfil hijo seleccionado vía prop `childId`). La cabecera muestra el nombre del jugador/a y el **nombre legible de su(s) equipo(s)** — resuelto cruzando `players.team_id` y la tabla puente `player_teams` contra `teams` (`nombre (categoría)`), de modo que nunca se pinta el UUID en crudo. A continuación, seis pestañas cuyo **origen de datos difiere** (importante, porque no todo sale de Supabase):

| Pestaña | Fuente de datos | Estado |
|---------|-----------------|--------|
| **Jornada** | Supabase `matches` (vía `useMatches`, filtrado por el/los UUID de equipo) | ✅ Real |
| **Calendario** | Supabase `matches` (mismos datos, lista completa ordenada) | ✅ Real |
| **Clasificación** | Supabase `standings` (filtrado por el UUID del equipo) | ✅ Real |
| **Eventos** | Supabase `club_events` (`order by event_date`) | ✅ Real |
| **Tablón** | *Demo store* `announcements`, que `useClubData` **hidrata desde `club_events`** | ✅ Real (vía puente) |
| **Galería** / **Stats** | — | ⏳ *"Próximamente"* (placeholder) |

Detalle de cada fuente:

- **Jornada** y **Calendario** — leen la tabla real **`matches`** de Supabase mediante el hook `useMatches(teamUuids)` (§7.19), filtrando por los UUID de equipo del jugador (resueltos en `resolveTeams` cruzando `player_teams` y `teams.name` contra `players.team_id`). *Jornada* toma el primer partido tras ordenar por fecha+hora, muestra el enfrentamiento en **orden federativo Local – Visitante** (`localVisitante`), la etiqueta **EN CASA/FUERA** (`is_home`) y, si hay `venue_address`, un enlace al pabellón en **Google Maps** (helper `mapsUrl`). *Calendario* lista todos los partidos del equipo con la misma tarjeta. → Materializa el **Módulo 6 (Fase 1)** del [`ROADMAP.md`](./ROADMAP.md).
- **Clasificación** — tabla `standings` de Supabase, filtrada por el **UUID del equipo** del jugador (se resuelve antes contra `teams`, ya que `players.team_id` puede almacenar un UUID o el nombre del equipo, evitando el error `22P02`). Columnas: posición, equipo rival, G, P, Pts.
- **Eventos** — tabla `club_events` de Supabase (torneos, campus, etc.), ordenada por fecha.
- **Tablón** — lee `announcements` del store demo, **pero** ese array **sí** está poblado: `useClubData` mapea cada fila de `club_events` a un anuncio (`title`/`description`/`event_date`). Es decir, *Eventos* y *Tablón* comparten origen real (`club_events`) por dos caminos distintos.
- **Galería** y **Stats** — recuadros *"Próximamente"* (componente `ComingSoon`); sin datos ni lógica todavía.

### 7.10 Selector de familia — `FamilySelector.tsx`

- Pantalla "¿Quién está viendo?" con el código de cuenta.
- Tile de **Adultos Responsables** (abre teclado de **PIN OTP** de 4 dígitos).
- Un tile por hijo/a, con avatar personalizable (`AvatarUpload`), equipo y edad calculada.
- Bloques de resumen: **Equipos** de los hijos y **Plan semanal** (agenda de partidos próximos).

### 7.11 Avatares — `AvatarUpload.tsx`

Subida de avatar para jugadores o perfiles: validación de tipo (JPG/PNG/WebP) y tamaño (máx. 2 MB), previsualización, subida a Storage `player-docs/avatars/...` y actualización de `players.avatar_url` o `profiles.avatar_url`.

### 7.12 Chats — `Chats.tsx`

Mensajería en **tiempo real** (Supabase Realtime) con estos tipos de canal:

- **`team`** — chat del equipo (jugadores + staff), oculto para categorías **U12**.
- **`family`** — chat de familias de un equipo (adultos responsables + staff).
- **`broadcast`** — canal de difusión del club (escritura solo admin/coach).
- **`private`** — conversación privada 1-a-1 entre **administración y una familia** (solo visible en el perfil de Adultos Responsables).
- **Canales de rol** (nuevos): **`admins`** (Administradores), **`coaches`** (Entrenadores) y **`staff`** (Staff). Son canales de grupo **sin equipo asociado** (`team_id NULL`) que reutilizan la tabla `team_messages`. Se muestran según el **array de roles** del usuario (un usuario puede tener varios): el admin participa en los tres; entrenadores y staff, en el suyo.

La construcción de la lista de canales depende del rol:
- **Admin**: canales de rol (admins/coaches/staff), canal de equipo y de familias por cada equipo, difusión, y un canal privado por familia.
- **Coach**: canal `coaches`, canales de sus equipos asignados + difusión.
- **Staff**: canal `staff` + difusión.
- **Family**: canal de familias por equipo de cada hijo, difusión (solo lectura) y canal privado con administración; el perfil hijo solo ve el chat de equipo si **no** es U12.
- **Player**: chat de su equipo si no es U12.

**Estado efectivo de cada canal** (`lib/chatChannels.ts` + tabla `chat_channels`): cada canal puede estar `enabled`/deshabilitado y en estado `open` / `closed` / `archived`. La **ausencia de fila equivale a activo y abierto** (compatibilidad hacia atrás). El visor aplica esa configuración: oculta los deshabilitados y los archivados, y marca los cerrados como **solo lectura**. La gestión de estos estados la realiza el admin desde `ChatsManager` (§7.15).

Reglas de acceso reforzadas en base de datos (RLS + función `user_can_access_team_channel`, ampliada para conceder acceso `admins→admin`, `coaches→coach`, `staff→staff`). La escritura además exige que el canal esté abierto (`chat_channel_open`). Marca de leídos en mensajes privados. Escucha el evento `open-private-chat` para saltar a la conversación con una familia concreta.

### 7.13 Cartelera / Tablón

- **`NewsBoard.tsx`**: pantalla de bienvenida del tablón general — actualmente **placeholder** ("Próximamente").
- **`Board.tsx`**: componente más completo (jornada / información con PDFs / tablón con publicación de anuncios por admin/coach) que opera sobre el *demo store*. No está enlazado en la navegación actual (queda como base para la cartelera definitiva).

### 7.14 `PlayersList.tsx`

Listado de jugadores con estadísticas de estado documental y búsqueda. Opera sobre el *demo store*; no está enlazado en la navegación actual.

### 7.15 Gestión de chats — `ChatsManager.tsx` (solo admin)

Consola que da al administrador control sobre el **ciclo de vida de cada canal**, accesible desde el botón "Gestionar chats" de `TeamsManager`. Persiste en la tabla `chat_channels` (upsert por `channel_key`):

- **Canales generales**: Difusión y los tres canales de rol (Administradores, Entrenadores, Staff).
- **Canales por equipo y familia**: por cada equipo, su chat de equipo (salvo U12, que solo tiene familias) y su chat de familias.

Por cada canal ofrece: **activar/desactivar** (`enabled`), cambiar el **estado** (`open` = abierto · `closed` = solo lectura · `archived` = archivado/oculto) y **eliminar** — que borra el **historial de mensajes** (`team_messages` filtrados por `channel_type`/`team_id`) y deja el canal desactivado, con diálogo de confirmación por ser irreversible. La lógica de claves y estado efectivo se comparte con el visor vía `lib/chatChannels.ts`.

### 7.16 Ficha Federativa PDF — `FederativaDoc.tsx` (family/senior)

Flujo de la **Ficha Federativa Única** que complementa al registro documental:
- Botón **"Descargar plantilla oficial"** (constante `FEDERATIVA_TEMPLATE_URL`, *placeholder configurable*: mientras no se publique el PDF oficial del club, el botón queda deshabilitado con una nota).
- Por cada `registrations` del usuario (adulto + menores), **subida del PDF firmado** tras el reconocimiento médico (`accept="application/pdf"`, a Storage `player-docs/${uid}/federativa_...pdf`). Al subir, se fija `federativa_pdf_url` y `federativa_status = 'pending'`.
- Badge de estado (**en revisión / aprobada / rechazada**) y enlace para ver el PDF subido.

El admin la valida como un documento más en `ValidationConsole` (§7.2). La escritura del PDF por parte de la familia se apoya en la política `registrations_update_own` añadida en esta fase.

### 7.17 Dorsales — `DorsalManager.tsx` (coach/admin)

- Selector de equipo (mismos equipos que en Asistencia: `coach_teams` para el coach, todos para el admin).
- Por jugador del equipo, campo de **dorsal** con guardado individual.
- El dorsal es **único dentro de cada equipo** (índice parcial `UNIQUE(team_id, dorsal)` en `player_teams`); al intentar duplicarlo se muestra un error claro.
- El guardado se hace vía **RPC `set_player_dorsal(_player_id, _team_id, _dorsal)`** (`SECURITY DEFINER`), que valida que el llamante es admin o coach y hace **upsert** del vínculo `player_teams`. Así los entrenadores asignan dorsales **sin** obtener permiso de escritura para reasignar equipos (que sigue siendo tarea del admin). Pasar dorsal vacío lo borra.

### 7.18 Tallas / Equipación — `EquipmentSizes.tsx` (family/senior)

Formulario de tallas por jugador **condicional al nivel del equipo**:
- Si alguno de los equipos del jugador tiene `teams.travels = true` (**"equipo que viaja"**, configurable en `TeamsManager`), se muestra el **pack completo**: equipación reversible, chándal, polo de paseo, sudadera y mochila reglamentaria.
- Si el jugador solo juega liga local, se muestra **solo la equipación reversible**.
- Las tallas se guardan (upsert por `player_id`) en la tabla `equipment_sizes`. La familia gestiona las de sus hijos/as; el jugador Senior las suyas (`selfPlayerId`). Admin/coach pueden leerlas (para la futura logística de pedidos del Módulo 9 completo).

### 7.19 Partidos / Calendario — `MatchesManager.tsx` (admin/coach gestionan; resto lectura)

Sección **"Partidos"** del menú, núcleo del **Módulo 6 (Fase 1)**. Es un componente único que se comporta según el rol (`canManage = admin | coach`):

- **Creación manual** (solo admin/coach): un `Dialog` con formulario (`useState` + validación manual + `toast`, mismo patrón que `ConvocatoriesManager`) que inserta en la tabla `matches`: equipo (del club), rival, condición **CASA/FUERA** (`is_home`), fecha, hora, pabellón, dirección del pabellón, fase de liga, nº de acta federativo y notas. El equipo del coach se limita a sus `coach_teams`.
- **Importación de fichero (Excel semanal)**: botón **presente pero deshabilitado** ("Próximamente"), reservando el sitio para el futuro UPSERT por `match_number`.
- **Visualización** (todos los roles): listado de partidos ordenado por fecha/hora, con el enfrentamiento en **orden federativo Local – Visitante** (`localVisitante`), badge **CASA** (color corporativo) / **FUERA**, fecha/hora, fase, y el **pabellón como enlace a Google Maps** (`mapsUrl`) cuando hay dirección. El coach solo ve los partidos de sus equipos; admin y roles de lectura ven todo el club.

Los datos se leen con el hook **`useMatches(teamIds?)`** (`src/hooks/use-matches.ts`) y se formatean con los helpers puros de **`src/lib/matches.ts`** (`sortMatches`, `localVisitante`, `mapsUrl`), reutilizados también por `PlayerView` (§7.9), `FamilyAgenda` (`FamilySelector`) y `Board`.

---

## 8. Capa de datos (Supabase)

### 8.1 Store de demo (`clubStore.ts` + `use-club-data.tsx`)

Existe un store cliente en memoria con tipos heredados (`Team`, `Player`, `Announcement`, etc.). El hook `useClubData` hidrata parcialmente este store desde Supabase (`teams`, `players`, `club_events`) y se suscribe a cambios en tiempo real. Sirve de **puente de compatibilidad** para las vistas heredadas mientras la migración a Supabase se completa. Los **partidos ya no viven en este store**: se retiró el tipo `Match` y el slice `matches` en la Fase 1, y todas las vistas leen la tabla real `matches` vía el hook `useMatches` (§7.19).

### 8.2 Esquema PostgreSQL (migraciones `supabase/migrations/`)

Tablas con **Row Level Security (RLS)** activada:

| Tabla | Propósito | Notas de acceso |
|-------|-----------|-----------------|
| `profiles` | Perfil de usuario (email, nombre, avatar, teléfono) | Lectura/edición propia; admin lee todos |
| `user_roles` | Roles por usuario (enum `app_role`) | Lectura propia; admin gestiona todos |
| `coach_teams` | Equipos asignados a un entrenador | Admin gestiona; coach lee lo suyo |
| `teams` | Equipos (nombre, categoría, `age_category`, `travels`) | Lectura para autenticados; admin gestiona |
| `players` | Jugadores (nombre, fecha nac., `team_id`, `family_id`, `avatar_url`, `user_id`) | Familia lee/edita sus hijos; el propio jugador Senior gestiona su ficha (`user_id = auth.uid()`); coach lee todos; admin gestiona |
| `player_teams` | Puente jugador↔equipo (**multi-equipo**) + `dorsal` (único por equipo) | Lectura autenticados; admin gestiona; dorsal vía RPC `set_player_dorsal` |
| `families_meta` | Ficha de familia (head, email, `reference_code`, `adult_pin`) | Familia lee/gestiona la suya; admin todo |
| `standings` | Clasificación por equipo | Lectura autenticados; admin gestiona |
| `club_events` | Eventos del club (torneos, campus…) | Lectura autenticados; admin gestiona |
| `matches` | Partidos/calendario (rival, `is_home`, fecha/hora, pabellón+dirección, fase, `match_number` único, estado) | Admin/coach gestionan (`created_by = auth.uid()`); autenticados leen |
| `team_messages` | Mensajes de canales team/family/broadcast/admins/coaches/staff | Controlado por `user_can_access_team_channel` + `chat_channel_open`; admin puede borrar |
| `chat_channels` | Config/estado de cada canal (`channel_key`, `kind`, `enabled`, `status`) | Lectura autenticados; gestión solo admin |
| `private_messages` | Mensajes privados admin↔familia | Solo admin y familia receptora; admin puede borrar |
| `registrations` | Registros federativos (adulto/menor, docs, autorizaciones, estados por documento, `federativa_pdf_url`/`federativa_status`) | Admin gestiona todo; cada usuario ve/inserta/**actualiza** los suyos (`user_id = auth.uid()`) |
| `payments` | Cuotas y pagos (importe, periodo, estado, comprobante) | Admin gestiona; familia/jugador ven y actualizan los suyos (por `family_id` o `players.user_id`) |
| `fee_schedules` | Importes y fechas límite de cada tipo de cuota (senior/federado/escuela) | Admin edita; todos leen |
| `convocatorias` | Convocatorias de entreno/partido (+ `min_players`) | Admin/coach gestionan; autenticados leen |
| `convocatoria_responses` | Respuestas de jugadores a convocatorias | Admin/coach todo; jugador/familia gestionan la suya |
| `convocatoria_extra_players` | Jugadores "doblados" en una convocatoria | Admin/coach gestionan; jugador/familia leen lo suyo |
| `attendance` | Asistencia por jugador/equipo/día (`status`, `absent_reason`) | Admin/coach gestionan (`recorded_by = auth.uid()`); jugador/familia leen lo suyo |
| `equipment_sizes` | Tallas de equipación por jugador | Familia/senior gestionan lo suyo; admin/coach leen |

Estas tablas están **versionadas en `supabase/migrations/`** desde el saneamiento de la **Fase 0** (migraciones `20260721090000`–`20260721090300`), las **Fases 2-5** (migraciones `20260722100000`–`20260722100300`) y la **Fase 1 · Calendario/Partidos** (migración `20260723100000_matches.sql`, que además siembra unos partidos de ejemplo), y **tipadas en `src/integrations/supabase/types.ts`** sin accesos `as any`.

**Funciones y triggers relevantes**:
- `handle_new_user()` — crea `profiles` + rol por defecto (`family`, o `admin` para emails bootstrap) y auto-vincula familias por email.
- `has_role(user, role)` — helper `SECURITY DEFINER` usado en las políticas RLS.
- `set_self_registration_role()` — RPC `SECURITY DEFINER` que fija el rol principal del propio usuario al terminar el registro (responsable/senior/coach/staff).
- `set_player_dorsal(_player_id, _team_id, _dorsal)` — RPC `SECURITY DEFINER` que fija el dorsal de un jugador en un equipo (upsert en `player_teams`); solo admin/coach, con dorsal único por equipo.
- `compute_family_reference_code()` + trigger `refresh_family_reference_code` — genera el código de familia a partir del hijo mayor.
- `derive_age_category()` — deriva `U12` / `U14+` a partir de la categoría del equipo.
- `user_can_access_team_channel()` — autoriza acceso a canales de chat (menores U12 sin chat de equipo; canales de rol `admins`/`coaches`/`staff`).
- `chat_channel_open(kind, team_id)` — indica si un canal admite escritura ahora mismo (activo y `open`); ausencia de fila ⇒ `true`.
- `update_updated_at_column()` — mantiene `updated_at`.

### 8.3 Storage

- Bucket público **`avatars`** (logo del club, avatares).
- Bucket **`player-docs`** (documentación de registro, comprobantes de pago, avatares subidos).

### 8.4 Realtime

Publicación `supabase_realtime` incluye `team_messages`, `private_messages` y, desde la Fase 2, `convocatoria_responses` y `convocatoria_extra_players` (para el refresco en vivo del panel de convocatorias del entrenador). `useClubData` también se suscribe a cambios de esquema para refrescar el store demo.

### 8.5 Saneamiento de migraciones (Fase 0)

El repo tuvo temporalmente una carpeta `supabase/manual/` con SQL **aditivo e idempotente que se aplicaba a mano** en el editor de Supabase/Lovable, para objetos creados fuera del pipeline de migraciones. En el **saneamiento de la Fase 0** ese SQL se **promovió a `supabase/migrations/`** y la carpeta manual se retiró:

- `20260721090000_players_columns_player_teams_storage.sql` — columnas `players.avatar_url` y `players.user_id` (+ RLS de Senior/familia), tabla puente `player_teams` (+ RLS) y bucket de Storage `player-docs` (+ políticas por carpeta de usuario).
- `20260721090100_registrations.sql` — tabla `registrations` (incluidas las columnas del semáforo por documento) + RLS.
- `20260721090200_payments.sql` — tabla `payments` + RLS.
- `20260721090300_convocatorias_and_registration_role.sql` — `convocatorias`, `convocatoria_responses` (+ RLS) y la RPC `set_self_registration_role`.

Los valores de enum `senior`/`staff` y el `CHECK` ampliado de `user_roles` ya se habían versionado antes (`20260720100000`, `20260720100001`). Todas las migraciones son idempotentes (`CREATE … IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE`), por lo que pueden reejecutarse sin romper la BD viva. Asumen la existencia previa del enum `app_role` y del helper `has_role()`, creados fuera de migraciones como el resto del esquema base.

### 8.6 Migraciones de las Fases 2-5

Añadidas de forma aditiva e idempotente, coherentes con las políticas RLS existentes:

- `20260722100000_attendance.sql` — tabla `attendance` (asistencia por jugador/equipo/día) + RLS (admin/coach gestionan; jugador/familia leen lo suyo) + trigger de `updated_at`.
- `20260722100100_federativa_pdf.sql` — columnas `registrations.federativa_pdf_url`/`federativa_status` + política `registrations_update_own` (para que la familia adjunte su ficha).
- `20260722100200_convocatorias_fase2.sql` — columna `convocatorias.min_players`, tabla `convocatoria_extra_players` (+ RLS) y alta de ambas tablas de convocatoria en la publicación `supabase_realtime`.
- `20260722100300_dorsales_tallas.sql` — `player_teams.dorsal` (+ índice único parcial por equipo), RPC `set_player_dorsal`, `teams.travels` y tabla `equipment_sizes` (+ RLS + trigger).

---

## 9. Reglas de negocio destacadas

- **Registro obligatorio**: sin registro federativo de adulto, la familia no accede al panel.
- **Identificador de cuenta** autogenerado `Apellido.Inicial-NN` (p. ej. `Perez.L-01`).
- **Categoría U12**: los menores de categoría U12 **no** tienen chat de equipo; su comunicación pasa por el chat de familias con los adultos responsables (aplicado tanto en UI como en RLS).
- **Prioridad de roles**: admin > coach > family > senior > staff > parent > player (el *responsable* prevalece sobre *senior*/*staff* cuando coexisten).
- **Jugador Senior**: un adulto +18 se registra como jugador de sí mismo (`players.user_id`) y ve su propia cuota, equipos y convocatorias.
- **Aprobación documental granular**: cada documento del registro se aprueba/rechaza por separado y el estado global se deriva.
- **PIN de adulto** configurable por familia (`adult_pin`), con fallback demo `1234`.
- **Canal de difusión**: solo escriben admin/coach; las familias lo tienen en modo lectura.
- **Ciclo de vida de los chats**: el admin puede activar/desactivar, cerrar (solo lectura), archivar (ocultar) o eliminar cualquier canal; la ausencia de configuración equivale a activo y abierto.

---

## 10. Estado del desarrollo, deuda técnica y pendientes

**Implementado y funcional** (contra Supabase): autenticación, registro federativo con tipos de usuario (responsable/senior/coach/staff), validación documental, gestión de equipos, asignación de jugadores (multi-equipo), gestión de miembros/roles, pagos con cuotas editables (admin y familia), chats en tiempo real (team/family/broadcast/privado + canales de rol) y su gestión por el admin, selector de familia con PIN, avatares.

**Saldado en la Fase 0** (saneamiento previo):
- ✅ **Migraciones versionadas**: `registrations`, `payments`, `convocatorias`, `convocatoria_responses` (y los objetos que vivían en `supabase/manual/`: columnas de `players`, `player_teams`, bucket `player-docs`, RPC de rol) ya están en `supabase/migrations/` — ver §8.5. `chat_channels` ya estaba versionada.
- ✅ **Tipos sin `as any`**: `types.ts` completado (columnas del semáforo por documento de `registrations`) y retirados los accesos `as any` sobre estas tablas. Queda un único `as any` residual sobre `players.id_card_number`, columna heredada inexistente en el esquema real (lectura legada tolerada en `use-club-data`).
- ✅ **Convocatorias con `useAuth`**: `created_by` = `user.id` y `player_id` = jugador del perfil activo; ya no hay placeholders `current_user_id`/`current_player_id`.

**Puntos de atención / deuda técnica pendiente**:
1. **Asistencia en localStorage**: `Attendance.tsx` no persiste en base de datos todavía.
2. **Partidos en datos demo**: la **Jornada** y el **Calendario** de `PlayerView` leen `matches` del *demo store* (`localStorage`), array que hoy arranca vacío y **no se hidrata** desde Supabase. Es el núcleo del **Módulo 6 (Calendario/GesDeportiva)** pendiente — ver [`ROADMAP.md`](./ROADMAP.md).
3. **Secciones "Próximamente"**: Galería y Stats en `PlayerView`, y `NewsBoard` (tablón general).
4. **Componentes no enlazados**: `Board.tsx` y `PlayersList.tsx` existen como base pero no están en la navegación actual.
5. El botón *"Reiniciar datos demo"* en la cabecera resetea el store local (utilidad de desarrollo).

> El plan priorizado de lo que falta (Calendario/GesDeportiva, Equipaciones, Ficha Federativa PDF, Convocatorias completas, Asistencia en Supabase, etc.) se mantiene en [`ROADMAP.md`](./ROADMAP.md).

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
│   ├── club/                  # Módulos de dominio (19 componentes)
│   │   ├── RegistrationFlow.tsx   ValidationConsole.tsx
│   │   ├── Payments.tsx           CuotaAnual.tsx
│   │   ├── Chats.tsx              ChatsManager.tsx
│   │   ├── TeamsManager.tsx       PlayerTeamAssignment.tsx
│   │   ├── RoleManager.tsx        Attendance.tsx
│   │   ├── ConvocatoriesManager.tsx  ConvocatoriesPlayer.tsx
│   │   ├── PlayerView.tsx         FamilySelector.tsx
│   │   ├── AvatarUpload.tsx       SignaturePad.tsx
│   │   ├── NewsBoard.tsx          Board.tsx  PlayersList.tsx
│   └── ui/                    # shadcn/ui (primitivas)
├── lib/
│   ├── auth-context.tsx       # AuthProvider + perfiles de familia + roles
│   ├── clubStore.ts           # Store demo (localStorage)
│   ├── chatChannels.ts        # Claves/estado efectivo de canales de chat
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

*Documento generado a partir del análisis del código fuente. Última revisión: 2026-07-21 (rama `claude/plan-roadmap-phases-2-5-53sozm`). El plan de trabajo pendiente vive en [`ROADMAP.md`](./ROADMAP.md).*
