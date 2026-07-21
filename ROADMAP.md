# Roadmap — SBT Maspalomas App

> Qué falta por implementar respecto al **plan de inicio del proyecto**
> (documento *"Resumen de Google del inicio del proyecto"*), contrastado con
> el estado real del código (`PRODUCT_SPEC.md` + revisión de `src/` y
> `supabase/migrations/`).
>
> Fecha de revisión: **2026-07-21** · Rama de trabajo: `claude/fase-1-crear-partidos-oamzjo`

---

## 1. Resumen ejecutivo

De los **10 bloques** descritos en el plan de inicio, **8 están implementados y
funcionales** contra Supabase (incluidos, tras las Fases 2-5, la Ficha Federativa
PDF, la asistencia persistida y las convocatorias completas), **2 lo están
parcialmente** (el Módulo 6 —calendario/GesDeportiva— ya tiene tabla `matches`,
creación manual y visualización real, y solo le falta el importador de Excel; y el
Módulo 9 tiene dorsales+tallas pero falta la tienda/consola de pedidos).
Las **2 fases "en reserva"** (Galería y Estadísticas) siguen como *"Próximamente"*.

| # | Módulo del plan | Estado | Falta principal |
|---|-----------------|:------:|-----------------|
| 1 | Infraestructura y Stack | ✅ Completo | — |
| 2 | Matriz de Roles (admin/coach/family) | ✅ Completo | — |
| 3 | Flujo "Netflix" + FamilySelector + PIN + Código de referencia | ✅ Completo | — |
| 4 | Admisión y Registro Federativo | ✅ Completo | — (Ficha Federativa PDF por jugador subida por el admin; foto, documento de identidad y tipo/número de documento en `players`) |
| 5 | Asistencia y Retrasos | ✅ Completo | — (persistida en Supabase, tabla `attendance`) |
| 6 | **Calendario e Importación Exprés (GesDeportiva)** | 🟡 Parcial | Tabla `matches` + RLS ✅, creación manual + Casa/Fuera real + visualización a todos los roles ✅; **falta** la importación de Excel con UPSERT por `match_number` (botón deshabilitado) |
| 7 | Comunicaciones y Canales | ✅ Completo | — (pulir cartelera/tablón) |
| 8 | Financiero (3 cuotas) | ✅ Completo | — |
| 9 | **Equipaciones y Logística de Ropa** | 🟡 Parcial | Dorsales blindados ✅ y packs de viaje/tallas ✅; **falta** tienda + consola de pedidos a fábrica |
| 10 | Convocatorias Múltiples y Bidireccionales | 🟡 Parcial | "Doblar" ✅, contador mínimo ✅, rechazos en vivo ✅; **falta** el vínculo a partido (depende del Módulo 6) |
| — | Galería Multimedia (reserva) | ⏳ Próximamente | Implementación completa |
| — | Estadísticas Técnicas (reserva) | ⏳ Próximamente | Implementación completa |

**Además — deuda técnica transversal:** ~~los tipos de `registrations`,
`payments`, `convocatorias` y `convocatoria_responses` se usan en el código pero
**no están versionados** en migraciones ni en `types.ts` (se acceden con
`as any`)~~. ✅ **Saldada en la Fase 0**: estas tablas ya están versionadas en
`supabase/migrations/` y tipadas en `types.ts` sin `as any`.

---

## 2. Detalle de lo que falta (por módulo)

### 🏀 Módulo 6 — Calendario e Importación Exprés (GesDeportiva) — *parcial (creación manual ✅)*

Ya existe la **tabla `matches`** en Supabase (con RLS) y toda la app la lee de forma
real: `PlayerView` (Jornada/Calendario), `MatchesManager` y `FamilyAgenda`,
con orden federativo Local–Visitante, indicador CASA/FUERA y botón a Google Maps del
pabellón (hooks `useMatches` + helpers `lib/matches.ts`). El *demo store* ya no guarda
partidos.

- ✅ **Tabla `matches`** con **`match_number` (nº oficial federativo)** preparado como clave del UPSERT (índice único parcial), `is_home`, fase, fecha/hora, `team_id`, pabellón + dirección.
- ✅ **Creación manual** de partidos por admin/coach (`MatchesManager`), con el equipo del coach limitado a sus `coach_teams`.
- ✅ **Visualización "sagrada"**: orden federativo `Local – Visitante`, indicador **CASA** (color corporativo) / **FUERA**, y **pabellón como enlace a Google Maps**.
- ⏳ **Importación del Excel semanal** del club (UPSERT por `match_number` para actualizar horarios provisionales o insertar nuevas fases): **pendiente**; el botón "Importar Excel" existe pero está **deshabilitado**.

### 👕 Módulo 9 — Equipaciones y Logística de Ropa — *parcial (dorsales + tallas ✅)*

- ✅ **Dorsales blindados**: `player_teams.dorsal` con **índice único por `team_id`**, fijado por el entrenador en `DorsalManager.tsx` vía RPC `set_player_dorsal`. Las familias no eligen número.
- ✅ **Packs de viaje automáticos**: `teams.travels` marca el nivel del equipo; `EquipmentSizes.tsx` muestra solo la equipación reversible (liga local) o el pack completo (chándal, polo, sudadera, mochila) para equipos que viajan. Tallas en `equipment_sizes`.
- ⏳ **Tienda y pedido a fábrica**: catálogo de reposición/merchandising + **consola de pedidos** del admin con **exportación a Excel** — *pendiente* (fuera del alcance actual).

### 📝 Módulo 4 — Ficha Federativa PDF — ✅ *implementado*

- ✅ Resubir la ficha **firmada en PDF** tras el reconocimiento médico (`FederativaDoc.tsx` → Storage `player-docs` + `registrations.federativa_pdf_url`/`federativa_status`).
- ✅ El admin la valida con el **semáforo** como 5º documento en `ValidationConsole`.
- ✅ Descargar la ficha federativa **por jugador**: el admin sube el PDF cumplimentado de cada jugador (`PlayerDocuments.tsx` → `players.federativa_pdf_url`) y la familia/senior lo descarga desde `FederativaDoc.tsx` (sustituye a la plantilla en blanco genérica).
- ✅ El admin sube además **foto** (`players.photo_url`) y **documento de identidad** (`players.id_document_url`) por jugador, y registra **tipo/número de documento** (`players.id_document_type`/`id_document_number`).
- ✅ **Alta e importación de jugadores** por el admin (`PlayerImport.tsx`, embebido en «Fichas jugadores»): alta **manual**, **importación CSV** con indicador de estructura + plantilla descargable (`src/lib/playersCsv.ts`), y **vinculación masiva de fotos desde un ZIP** cuyo nombre de fichero es el identificador del jugador (nº de documento / nombre; lector ZIP sin dependencias en `src/lib/zip.ts`).

### 📋 Módulo 10 — Convocatorias — *casi completo (falta vínculo a partido)*

- ✅ **"Doblar" jugadores de otras categorías** (`convocatoria_extra_players`).
- ✅ **Contador en tiempo real** en **rojo** si no se llega al mínimo (`convocatorias.min_players`), con roster por jugador y refresco en vivo (Realtime).
- ⏳ **Tarjetas por partido de la semana** (vínculo `convocatoria → match`) — pendiente del Módulo 6.
- ✅ Placeholders `current_user_id`/`current_player_id` retirados (integrados con `useAuth`, ya en Fase 0). Corregido el filtrado de `ConvocatoriesPlayer` (mostraba todas).

### ⏱️ Módulo 5 — Asistencia — ✅ *persistida en Supabase*

`Attendance.tsx` (Presente/Retraso/Ausente + motivo + histórico mensual) ahora
persiste en la **tabla `attendance`** de Supabase (upsert por `player_id+team_id+date`)
con RLS (admin/coach gestionan; jugador/familia leen lo suyo). Retirado `localStorage`.

### 🖼️ / 📊 Fases en reserva

- **Galería Multimedia**: repositorio de fotos por partido con **RLS** para que cada familia/jugador solo vea las de su categoría. Hoy es *"Próximamente"* en `PlayerView`.
- **Estadísticas Técnicas**: panel del entrenador para anotar puntos/faltas/rebotes/asistencias + **gráficos evolutivos** en el perfil del jugador. Hoy es *"Próximamente"*.

### 🧱 Deuda técnica transversal (bloqueante)

- ✅ **Versionar tipos y migraciones** de `registrations`, `payments`, `convocatorias`, `convocatoria_responses`; regenerar `src/integrations/supabase/types.ts` y eliminar los `as any`. *(Hecho en Fase 0.)*
- ✅ **Cartelera/Tablón general** (`NewsBoard`) implementada contra Supabase (tabla
  `announcements`, RLS + Realtime) y enlazada en la navegación; el `Board.tsx` demo
  se retiró. Queda `PlayersList.tsx`, que existe pero no está enlazado en la navegación.

---

## 3. Roadmap por fases

Orden recomendado por dependencias y valor. Estimaciones en jornadas de
desarrollo (orientativas).

### Fase 0 — Saneamiento previo · *bloqueante* — ✅ **Completada**
Base sana antes de construir módulos nuevos.
1. ✅ Versionadas las migraciones de `registrations`, `payments`, `convocatorias`,
   `convocatoria_responses` (más los objetos manuales previos: columnas de
   `players`, `player_teams`, bucket `player-docs` y el RPC
   `set_self_registration_role`). El SQL manual (`supabase/manual/…`) se promovió
   al pipeline de migraciones y se retiró.
2. ✅ `types.ts` completado (se añadieron las columnas del semáforo por documento
   de `registrations`) y retirados los accesos `as any` sobre estas tablas. Queda
   sólo un `as any` residual en `use-club-data` sobre `players.id_card_number`,
   columna heredada que no existe en el esquema real (lectura legada tolerada).
3. ✅ Convocatorias ya usan `useAuth` (`created_by = user.id`, `player_id` del
   perfil activo); no quedaban placeholders `current_user_id`/`current_player_id`.

### Fase 1 — Calendario e Importación GesDeportiva (Módulo 6) · *alta prioridad* — 🟡 **Parcial** (creación manual ✅; importador pendiente)
Es el núcleo deportivo del que dependen Convocatorias, Jornada y Cartelera.
1. ✅ Tabla `matches` (con `match_number` único parcial preparado para el UPSERT, fase, `is_home`, fecha/hora, `team_id`, pabellón + dirección) + RLS + seed de partidos de ejemplo (migración `20260723100000_matches.sql`).
2. ⏳ Importador de Excel semanal (arrastrar y soltar) con lógica **UPSERT por `match_number`** — **pendiente**; el botón "Importar Excel" existe en `MatchesManager` pero está **deshabilitado**.
3. ✅ Creación manual de partidos (admin/coach en `MatchesManager`) y visualización real conectada a la tabla: `PlayerView` (Jornada + Calendario), `MatchesManager` y `FamilyAgenda`, con orden federativo Local–Visitante, indicador CASA/FUERA y botón a Google Maps del pabellón (hooks `useMatches` + helpers `lib/matches.ts`).
4. ✅ Retirado `matches` del *demo store* (`clubStore`): el tipo `Match` y el slice `matches` ya no existen; todo se lee de Supabase.

### Fase 2 — Convocatorias completas (Módulo 10) · *alta* — ✅ **Completada** (salvo vínculo a partido)
1. ⏳ Vincular convocatoria de partido a un `match` — **pendiente**, depende de la Fase 1.
2. ✅ **"Doblar"**: jugadores de otras categorías (`convocatoria_extra_players`).
3. ✅ **Contador de mínimo federativo** (`convocatorias.min_players`) en rojo cuando no se alcanza.
4. ✅ Rechazos/confirmaciones en vivo (Supabase Realtime) en el panel del entrenador, con roster por jugador. Corregido además el filtrado de `ConvocatoriesPlayer` (antes mostraba todas).

### Fase 3 — Asistencia en Supabase (Módulo 5) · *media* — ✅ **Completada**
1. ✅ Tabla `attendance` + RLS. 2. ✅ `Attendance.tsx` migrado de `localStorage` a Supabase (upsert por `player_id+team_id+date`) manteniendo el histórico mensual.

### Fase 4 — Ficha Federativa PDF (Módulo 4) · *media* — ✅ **Completada**
1. ✅ Descarga de la ficha **por jugador**: el admin sube el PDF cumplimentado (`PlayerDocuments.tsx` → `players.federativa_pdf_url`) y la familia/senior lo descarga en `FederativaDoc.tsx` (sustituye a la plantilla en blanco genérica). El admin gestiona también foto, documento de identidad y tipo/número de documento por jugador.
2. ✅ Resubida del PDF firmado a Storage + `federativa_pdf_url`/`federativa_status` en `registrations` (`FederativaDoc.tsx`).
3. ✅ Integrado como 5º documento en el semáforo de `ValidationConsole`.

### Fase 5 — Equipaciones y Logística (Módulo 9) · *media/alta esfuerzo* — 🟡 **Parcial** (dorsales + tallas)
1. ✅ Dorsales: `player_teams.dorsal` + **índice único por `team_id`** + RPC `set_player_dorsal` + panel del entrenador (`DorsalManager.tsx`).
2. ✅ Formulario de tallas condicional al nivel del equipo (`teams.travels` + `equipment_sizes` + `EquipmentSizes.tsx`).
3. ⏳ Tienda/merchandising + consola de pedidos del admin con export a Excel — **pendiente** (fuera del alcance actual).

### Fase 6 — Cartelera/Tablón definitivo · *media* — ✅ **Completada**
1. ✅ Consolidada en una cartelera real contra Supabase: tabla `announcements`
   (título, cuerpo, `pinned`, `author_id`) con RLS (admin/coach publican/editan/
   borran; cualquier autenticado lee) y Realtime. `NewsBoard.tsx` reescrito
   (antes *"Próximamente"*) con formulario de publicación para admin/coach, fijado
   de avisos y refresco en vivo; enlazado ya en la navegación (vista `cartelera`).
   Retirado el `Board.tsx` demo (sobre `clubStore`), ahora obsoleto.

### Fase 7 — Fases en reserva · *baja / cuando el MVP esté cerrado*
1. **Galería Multimedia** con RLS por categoría — ~4-5 días.
2. **Estadísticas Técnicas** con captura post-partido y gráficos evolutivos — ~5-7 días.

---

## 4. Ruta crítica (resumen visual)

```
Fase 0 (saneamiento)
   │
   ▼
Fase 1 · Calendario/GesDeportiva ──► Fase 2 · Convocatorias completas
   │
   ├──► Fase 3 · Asistencia en Supabase        (independiente)
   ├──► Fase 4 · Ficha Federativa PDF           (independiente)
   ├──► Fase 5 · Equipaciones y Logística        (independiente)
   └──► Fase 6 · Cartelera definitiva            (independiente)
                         │
                         ▼
               Fase 7 · Galería + Estadísticas (reserva)
```

**Recomendación:** cerrar primero **Fase 0 → 1 → 2** (núcleo deportivo del MVP),
luego paralelizar 3/4/5/6 según recursos, y dejar la Fase 7 para cuando el MVP
esté estabilizado.
