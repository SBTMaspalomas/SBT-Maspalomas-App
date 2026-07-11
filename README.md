# SBT Maspalomas - App de Gestión del Club

Aplicación web integral para la gestión de un club de baloncesto, desarrollada con **React + Vite** y conectada a **Supabase** para autenticación, base de datos y almacenamiento de documentos.

## Características

- **Autenticación**: Sistema de roles (Admin, Entrenador, Padres, Jugadores)
- **Registro Federativo**: Formulario completo con subida de documentos
- **Gestión de Equipos**: Control de equipos por categoría
- **Control de Asistencia**: Registro de entrenamientos y partidos
- **Gestión de Pagos**: Control de cuotas y justificantes
- **Comunicaciones**: Chats en tiempo real entre usuarios
- **Cartelera**: Anuncios y eventos del club

## Stack Tecnológico

- **Frontend**: React 19 + Vite
- **Estilos**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Base de Datos**: Supabase (PostgreSQL)
- **Almacenamiento**: Supabase Storage
- **Autenticación**: Supabase Auth
- **Routing**: TanStack Router

## Instalación

```bash
npm install
npm run dev
```

## Despliegue

La aplicación está configurada para desplegarse en **Vercel** con integración automática desde GitHub.

### Variables de Entorno

```
VITE_SUPABASE_URL=https://kiifznmcpyvalupdtnrq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<tu-anon-key>
```

## Estructura del Proyecto

```
src/
├── components/        # Componentes React reutilizables
├── pages/            # Páginas de la aplicación
├── lib/              # Utilidades y helpers
├── integrations/     # Integración con Supabase
├── hooks/            # Custom React hooks
└── routes/           # Definición de rutas
```

## Estado del Desarrollo

- ✅ Fase 1: Conexión a Supabase completada
- ✅ Fase 2: Registro de jugadores funcional
- ✅ Fase 3: Subida de documentos a Storage
- 🔄 Fase 4: Gestión deportiva (Partidos, Asistencia)
- ⏳ Fase 5: Comunicaciones en tiempo real
- ⏳ Fase 6: Gestión de pagos

## Licencia

Privado - SBT Maspalomas
