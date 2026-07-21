# Roadmap — SBT Maspalomas App

> Qué falta por implementar respecto al **plan de inicio del proyecto**
> (documento *"Resumen de Google del inicio del proyecto"*), contrastado con
> el estado real del código (`PRODUCT_SPEC.md` + revisión de `src/` y
> `supabase/migrations/`).
>
> Fecha de revisión: **2026-07-21** · Rama de trabajo: `claude/session-2f11tg`

---

## 1. Resumen ejecutivo

De los **10 bloques** descritos en el plan de inicio, **6 están implementados y
funcionales** contra Supabase, **2 lo están parcialmente** (dependen de
`localStorage` / datos demo) y **2 módulos completos no existen todavía**.
Las **2 fases "en reserva"** (Galería y Estadísticas) siguen como *"Próximamente"*.

| # | Módulo del plan | Estado | Falta principal |
|---|-----------------|:------:|-----------------|
| 1 | Infraestructura y Stack | ✅ Completo | — |
| 2 | Matriz de Roles (admin/coach/family) | ✅ Completo | — |
| 3 | Flujo "Netflix" + FamilySelector + PIN + Código de referencia | ✅ Completo | — |
| 4 | Admisión y Registro Federativo | 🟡 Parcial | **Ficha Federativa PDF** (descargar→firmar→resubir→validar) |
| 5 | Asistencia y Retrasos | 🟡 Parcial | Persistencia en **Supabase** (hoy en `localStorage`) |
| 6 | **Calendario e Importación Exprés (GesDeportiva)** | ❌ **No existe** | Tabla `matches`, importación Excel con UPSERT por `match_number`, Casa/Fuera real |
| 7 | Comunicaciones y Canales | ✅ Completo | — (pulir cartelera/tablón) |
| 8 | Financiero (3 cuotas) | ✅ Completo | — |
| 9 | **Equipaciones y Logística de Ropa** | ❌ **No existe** | Dorsales blindados, packs de viaje, tienda + pedido a fábrica |
| 10 | Convocatorias Múltiples y Bidireccionales | 🟡 Parcial | "Doblar" categorías, contador mínimo, vínculo a partido, quitar placeholders |
| — | Galería Multimedia (reserva) | ⏳ Próximamente | Implementación completa |
| — | Estadísticas Técnicas (reserva) | ⏳ Próximamente | Implementación completa |

**Además — deuda técnica transversal:** ~~los tipos de `registrations`,
`payments`, `convocatorias` y `convocatoria_responses` se usan en el código pero
**no están versionados** en migraciones ni en `types.ts` (se acceden con
`as any`)~~. ✅ **Saldada en la Fase 0**: estas tablas ya están versionadas en
`supabase/migrations/` y tipadas en `types.ts` sin `as any`.

---

## 2. Detalle de lo que falta (por módulo)

### 🏀 Módulo 6 — Calendario e Importación Exprés (GesDeportiva) — *no existe*

El plan describe el corazón deportivo de la app y **hoy no hay nada real** detrás:
`PlayerView` lee los partidos del *demo store* (`localStorage`) filtrando por
nombre de equipo. No existe tabla `matches` en Supabase.

Falta:
- **Tabla `matches`** en Supabase con **`match_number` (nº oficial federativo) como clave** para el UPSERT.
- **Importación del Excel semanal** del club: al arrastrar el fichero, *actualiza* horarios provisionales si el `match_number` ya existe o *inserta* los nuevos (fases nuevas de liga).
- **Modelo flexible**: calendarios escalonados, múltiples fases de liga y campos de juego variables.
- **Visualización "sagrada"**: orden federativo `Local – Visitante`, indicador **[🏠 CASA]** (color corporativo) / **[🚗 FUERA]** (fondo neutro).
- **Nombre del pabellón como botón** que abre la ruta en Google Maps (la UI existe en demo; falta enlazarla a datos reales).

### 👕 Módulo 9 — Equipaciones y Logística de Ropa — *no existe*

No hay ningún componente, tabla ni lógica. Falta por completo:
- **Dorsales blindados**: el dorsal lo fija el entrenador en su panel; **constraint de unicidad** en BD que impida dos dorsales iguales dentro del mismo `team_id`. Las familias no eligen número.
- **Packs de viaje automáticos**: el formulario de tallas cambia según el nivel del equipo — liga local = solo equipación reversible; equipo que viaja = chándal, polo de paseo, sudadera y mochila reglamentaria.
- **Tienda y pedido a fábrica**: catálogo voluntario de reposición/merchandising para familias + **consola de pedidos** del admin que agrupa por talla y categoría (ej. "12 sudaderas talla M") con **exportación a Excel** para enviar a fábrica.

### 📝 Módulo 4 — Ficha Federativa PDF — *falta la pieza clave*

El registro (`RegistrationFlow`) ya sube foto carnet y DNIs (JPG) y captura
firma digital, y `ValidationConsole` valida con semáforo. **Falta** el flujo de
la *Ficha Federativa Única*:
- Descargar el **documento oficial** desde la app.
- Volver a subirlo **firmado en PDF** tras el reconocimiento médico.
- Que el admin lo valide con el **semáforo** (Verde/Amarillo/Rojo) como un documento más.

*(La estructura demo ya prevé un campo `federativaPdf`; falta implementarlo contra Supabase Storage + estado en `registrations`.)*

### 📋 Módulo 10 — Convocatorias — *funciona pero incompleto*

`ConvocatoriesManager`/`ConvocatoriesPlayer` crean convocatorias y recogen
respuestas confirmar/rechazar. Falta lo que el plan detalla:
- **"Pescar" jugadores de categorías inferiores** autorizados a doblar según reglamento.
- **Contador en tiempo real** que avisa en **rojo** si no se llega al mínimo federativo exigido en acta.
- **Tarjetas independientes por cada partido de la semana** (vínculo `convocatoria → match`, dependiente del Módulo 6).
- **Quitar los placeholders** `created_by = "current_user_id"` y `player_id = "current_player_id"` e integrarlos con `useAuth`.

### ⏱️ Módulo 5 — Asistencia — *persistencia pendiente*

`Attendance.tsx` funciona (Presente/Retraso/Ausente + motivo + histórico mensual)
pero persiste en `localStorage` (`attendance_v2`). Falta **tabla `attendance`
en Supabase** con RLS (coach de sus equipos / admin) y migrar la lectura/escritura.

### 🖼️ / 📊 Fases en reserva

- **Galería Multimedia**: repositorio de fotos por partido con **RLS** para que cada familia/jugador solo vea las de su categoría. Hoy es *"Próximamente"* en `PlayerView`.
- **Estadísticas Técnicas**: panel del entrenador para anotar puntos/faltas/rebotes/asistencias + **gráficos evolutivos** en el perfil del jugador. Hoy es *"Próximamente"*.

### 🧱 Deuda técnica transversal (bloqueante)

- ✅ **Versionar tipos y migraciones** de `registrations`, `payments`, `convocatorias`, `convocatoria_responses`; regenerar `src/integrations/supabase/types.ts` y eliminar los `as any`. *(Hecho en Fase 0.)*
- **Cartelera/Tablón general** (`NewsBoard`) sigue como placeholder; `Board.tsx` y `PlayersList.tsx` existen pero no están enlazados en la navegación.

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

### Fase 1 — Calendario e Importación GesDeportiva (Módulo 6) · *alta prioridad* — ~5-7 días
Es el núcleo deportivo del que dependen Convocatorias, Jornada y Cartelera.
1. Tabla `matches` (con `match_number` único para el UPSERT, fase, campo, local/visitante, fecha/hora, `team_id`, venue) + RLS.
2. Importador de Excel semanal (arrastrar y soltar) con lógica **UPSERT por `match_number`**.
3. Conectar `PlayerView` (Jornada + Calendario) a la tabla real; indicador CASA/FUERA con color corporativo y botón a Google Maps del pabellón.
4. Retirar `matches` del *demo store*.

### Fase 2 — Convocatorias completas (Módulo 10) · *alta* — ~3-4 días · depende de Fase 1
1. Vincular convocatoria de partido a un `match`; **una tarjeta por partido de la semana**.
2. **"Doblar"**: selección de jugadores de categorías inferiores autorizados.
3. **Contador de mínimo federativo** en rojo cuando no se alcanza.
4. Reflejar en vivo los rechazos en el panel del entrenador.

### Fase 3 — Asistencia en Supabase (Módulo 5) · *media* — ~1-2 días
1. Tabla `attendance` + RLS. 2. Migrar `Attendance.tsx` de `localStorage` a Supabase manteniendo el histórico mensual.

### Fase 4 — Ficha Federativa PDF (Módulo 4) · *media* — ~2-3 días
1. Descarga del documento oficial. 2. Resubida del PDF firmado a Storage + estado en `registrations`. 3. Integrarlo en el semáforo de `ValidationConsole`.

### Fase 5 — Equipaciones y Logística (Módulo 9) · *media/alta esfuerzo* — ~6-8 días
1. Dorsales: campo + **constraint único por `team_id`** + panel del entrenador.
2. Formulario de tallas condicional al nivel del equipo (packs de viaje).
3. Tienda/merchandising + consola de pedidos del admin con **agrupación por talla/categoría y export a Excel**.

### Fase 6 — Cartelera/Tablón definitivo · *media* — ~2-3 días
1. Consolidar `NewsBoard`/`Board` en una cartelera real contra Supabase y enlazarla en navegación.

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
