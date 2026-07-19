<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

---

# PROTOCOLO OBLIGATORIO — Modificaciones sobre SBT-Maspalomas-App

Para realizar modificaciones sobre el proyecto, debes asumir que el sistema es
complejo, con múltiples dependencias internas, y que cualquier cambio puede
afectar a componentes aparentemente no relacionados.

## Norma principal

**No puedes realizar ninguna modificación sin analizar previamente todas sus
consecuencias sobre el conjunto del proyecto.**

Cada cambio debe tratarse como una modificación arquitectónica, nunca como una
edición aislada. Cada modificación debe considerarse una operación crítica sobre
un sistema en producción.

## Obligaciones antes de modificar

Antes de escribir una sola línea de código debes:

1. Identificar todos los archivos, funciones, componentes, hooks, servicios,
   APIs, tablas, políticas RLS, triggers, Edge Functions, middleware, utilidades
   y dependencias que puedan verse afectados, tanto directa como indirectamente.
2. Construir mentalmente el flujo completo de ejecución antes y después del cambio.
3. Detectar posibles efectos colaterales.
4. Evaluar el impacto sobre: autenticación · autorización · Supabase · Vercel ·
   base de datos · APIs · Server Actions · Client Components · rutas · middleware ·
   cachés · estados React · hooks · formularios · navegación · procesos asíncronos ·
   almacenamiento · tiempo de ejecución · RLS.

## Está terminantemente prohibido introducir

código duplicado · lógica redundante · funciones huérfanas · imports innecesarios ·
variables sin uso · tablas sin referencia · columnas sin utilización · políticas
RLS inconsistentes · migraciones incompletas · referencias rotas · dependencias
circulares · bucles infinitos · llamadas recursivas no controladas · consultas
ineficientes · condiciones de carrera · fugas de memoria · código muerto ·
incompatibilidades de tipos · errores sintácticos · errores de tipado · errores de
compilación · errores de build · errores de hidratación · errores de despliegue en
Vercel.

## Cada modificación debe dejar el proyecto

completamente consistente · completamente funcional · completamente integrado ·
sin elementos pendientes · sin deuda técnica añadida · sin inconsistencias ·
sin pérdida de funcionalidad existente.

## Validación obligatoria (antes de dar cualquier tarea por finalizada)

- [ ] Todos los imports siguen siendo válidos.
- [ ] Todas las exportaciones siguen siendo válidas.
- [ ] No existen referencias rotas.
- [ ] No existen llamadas a funciones eliminadas.
- [ ] No existen componentes desconectados.
- [ ] No existen migraciones incompatibles.
- [ ] Las políticas RLS siguen siendo coherentes.
- [ ] La estructura de la base de datos permanece íntegra.
- [ ] Todas las consultas a Supabase siguen funcionando.
- [ ] Todos los tipos de TypeScript son compatibles.
- [ ] No existen errores de ESLint.
- [ ] No existen errores de compilación.
- [ ] El proyecto puede desplegarse correctamente en Vercel.
- [ ] El flujo de navegación permanece intacto.
- [ ] Ningún proceso puede generar bloqueos o bucles infinitos.
- [ ] No quedan "cabos sueltos" derivados de la modificación.
- [ ] **No se ha omitido ninguna instrucción o modificación solicitada.** No se
      puede "olvidar" ni "pasar por alto" nada de lo pedido; de hacerlo habría que
      volver a especificarlo en la siguiente actualización.

### Comandos de validación de este repositorio

Ejecuta y deja en verde, en este orden, antes de cerrar cualquier cambio:

Gestor de paquetes oficial: **bun** (`bun.lock`). No reintroduzcas
`package-lock.json` ni `pnpm-lock.yaml`.

```bash
bun install                 # instala dependencias
bunx tsc -p tsconfig.json --noEmit   # comprobación de tipos TypeScript
bun run lint                # ESLint (eslint .)
bun run build               # build de producción (vite build) — debe compilar limpio
```

Para cambios de base de datos revisa siempre `supabase/migrations/` y
`supabase/config.toml`: cada nueva migración debe ser aditiva, idempotente cuando
sea posible, y coherente con las políticas RLS existentes.

## Forma de trabajar

- No hagas cambios rápidos.
- No hagas suposiciones.
- No improvises.
- Analiza todo primero.
- Razona bien después.

Implementa únicamente cuando estés seguro de que el cambio mantiene la integridad
completa del sistema.

Si detectas en lo que se te pide cualquier incongruencia, incertidumbre,
dependencia oculta o posible efecto secundario, **DETENTE**, indícalo
explícitamente y propón la solución más robusta antes de modificar el código.

Tu objetivo no es únicamente que el código funcione, sino preservar la
estabilidad, coherencia, usabilidad y mantenibilidad de todo el proyecto.

---

# Contexto técnico del proyecto

Referencia rápida para no re-descubrir la arquitectura en cada cambio.

- **Framework**: TanStack Start + TanStack Router (`@tanstack/react-start`,
  `@tanstack/react-router`) sobre **React 19** y **Vite 8**.
- **Estilos**: Tailwind CSS 4 + shadcn/ui (Radix UI). Config en `components.json`.
- **Backend**: **Supabase** (PostgreSQL + Auth + Storage). Integración en
  `src/integrations/`; migraciones y RLS en `supabase/migrations/`.
- **Datos/estado**: TanStack Query (`@tanstack/react-query`), formularios con
  `react-hook-form` + `zod`.
- **Despliegue**: **Vercel** con integración automática desde GitHub. El build
  debe quedar siempre limpio para no romper el despliegue.
- **Conectado a Lovable**: no reescribas historia git ya publicada (ver bloque
  superior). Mantén la rama en estado funcional en cada push.

## Estructura de `src/`

```
src/
├── components/     # Componentes React reutilizables (incluye ui/ de shadcn)
├── routes/         # Rutas de TanStack Router (routeTree.gen.ts es generado)
├── hooks/          # Custom hooks
├── integrations/   # Cliente y tipos de Supabase
├── lib/            # Utilidades y helpers
├── router.tsx      # Configuración del router
├── server.ts       # Entrada de servidor (TanStack Start)
└── styles.css      # Estilos globales / Tailwind
```

> `src/routeTree.gen.ts` es **autogenerado** — no lo edites a mano.

## Variables de entorno

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```
