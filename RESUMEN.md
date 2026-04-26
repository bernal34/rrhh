# Resumen del Proyecto

**Portal RRHH** es un portal web integral para la gestión de Recursos Humanos, diseñado para empresas que necesitan administrar empleados, asistencia, nómina, documentos y reportes desde una sola plataforma.

## ¿Qué hace?

El portal centraliza todos los procesos de RRHH y ofrece:

- **Gestión de empleados:** alta, baja, edición, fotos, sueldos, notas y documentos por colaborador.
- **Multi-empresa y multi-sucursal:** soporte para varias empresas con membretes, logos y configuraciones independientes.
- **Asistencia automatizada:** integración con **HikCentral Connect** (reloj checador biométrico) vía pull periódico y webhooks. Incluye importador CSV manual.
- **Nómina:** motor de cálculo con conceptos recurrentes, bonos, préstamos, prenóminas, periodos, recibos PDF con membrete y reportes (prenómina detallada, acumulado por periodo, resumen anual, aguinaldo, PTU).
- **Portal del empleado (self-service):** cada colaborador consulta su asistencia, recibos, vacaciones y documentos.
- **Cumplimiento normativo:** módulos de **NOM-035** (riesgo psicosocial), vacaciones según **LFT**, incidencias y actas administrativas.
- **Documentos con vencimiento:** Storage en Supabase con alertas.
- **Otros módulos:** organigrama, capacitación, calendario, calculadoras, auditoría, notificaciones, onboarding, puestos, horarios y reportes.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + React Router |
| Backend / DB | Supabase (Postgres + Auth + Storage + Edge Functions en Deno) |
| Reloj checador | HikCentral Connect OpenAPI (HMAC-SHA256) |
| Deploy | Vercel (frontend) + Supabase (backend) |

## Arquitectura

- **Frontend SPA** (`src/`): un módulo por área funcional (`empleados`, `nomina`, `asistencia`, `vacaciones`, `nom035`, etc.), con `services/` como capa de acceso a Supabase y `hooks/` reutilizables.
- **Base de datos** (`supabase/migrations/`): esquema versionado con 16+ migraciones que cubren auth, RLS, horarios, prenómina, incidencias, permisos por módulo, multi-empresa y portal del empleado.
- **Edge Functions** (`supabase/functions/`):
  - `hik-sync-checadas`: pull periódico de checadas (cron cada 10 min).
  - `hik-create-person`: alta automática de personas en HCC.
  - `hik-webhook`: recepción push de eventos de control de acceso.
- **Identidad visual:** sistema multi-color semántico por módulo, con esmeralda como color primario de marca.

## Estado actual

Completado: scaffolding, esquema DB, multi-empresa, integración HikCentral, motor de nómina, recibos PDF, portal del empleado, NOM-035, préstamos, vacaciones, importador CSV de asistencia y reportes PDF.

Pendiente del roadmap: refinar permisos por rol, dashboard con KPIs y reportes adicionales (rotación, vencimientos).
