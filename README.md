# Portal RRHH

Portal web para gestión de Recursos Humanos: empleados, asistencia (vía HikCentral Connect), nómina, documentos y reportes.

## Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + React Router
- **Backend / DB:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Reloj checador:** HikCentral Connect OpenAPI (HMAC-SHA256)
- **Deploy:** Vercel (frontend) + Supabase (backend)

## Setup local

```bash
cd rrhh-portal
npm install
cp .env.example .env   # llenar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Abre http://localhost:5174

## Supabase

### Crear proyecto
1. Crear proyecto nuevo en https://supabase.com/dashboard
2. Copiar `URL` y `anon key` al `.env`
3. Ejecutar la migración:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

### Secrets para Edge Functions
```bash
npx supabase secrets set HIK_BASE_URL=https://open.hikcentralconnect.com
npx supabase secrets set HIK_API_KEY=...
npx supabase secrets set HIK_API_SECRET=...
npx supabase secrets set HIK_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### Deploy de Edge Functions
```bash
npx supabase functions deploy hik-sync-checadas
npx supabase functions deploy hik-create-person
npx supabase functions deploy hik-webhook
```

### Programar el pull cada 10 min
En el SQL editor de Supabase:
```sql
select cron.schedule(
  'hik-sync-checadas',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<project>.functions.supabase.co/hik-sync-checadas',
    headers := '{"Authorization": "Bearer <anon-or-service-key>"}'::jsonb
  );
  $$
);
```

### Webhook en HikCentral Connect
En HCC Console → **Event Subscription**, configurar:
- URL: `https://<project>.functions.supabase.co/hik-webhook`
- Header custom: `x-webhook-secret: <mismo valor del secret>`
- Eventos: `Access Control Event` (checadas)

## Deploy en Vercel (frontend)

El backend vive en Supabase. En Vercel solo se monta el frontend (Vite SPA).

### 1. Importar el repo
1. Push del repo a GitHub.
2. En https://vercel.com/new, "Import" del repo.
3. Vercel detecta Vite automáticamente. El `vercel.json` ya define `buildCommand`, `outputDirectory` y los rewrites para que React Router funcione en deep links.

### 2. Variables de entorno
En Vercel → Project Settings → Environment Variables, agregar para los 3 entornos (Production, Preview, Development):

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |

> **No** poner aquí `HIK_*` ni el `service_role` de Supabase. Esos son secretos server-side y viven en `supabase secrets set ...`.

### 3. CORS / Auth en Supabase
Después del primer deploy, en Supabase → Authentication → URL Configuration:
- **Site URL:** `https://<tu-dominio>.vercel.app`
- **Redirect URLs:** agregar `https://<tu-dominio>.vercel.app/**` y, si usarás dominio propio, también `https://<tu-dominio-custom>/**`.

### 4. Dominio custom (opcional)
Vercel → Domains → agregar el dominio y seguir las instrucciones de DNS.

## Estructura
```
src/
  components/          Componentes compartidos (Layout, etc.)
  modules/             Un directorio por módulo del portal
    empleados/
    asistencia/
    nomina/
    documentos/
    reportes/
  services/            Acceso a Supabase (data layer)
  hooks/               React hooks reutilizables
  lib/                 Cliente Supabase, utils
  types/               Tipos compartidos (Database de Supabase)
supabase/
  migrations/          Migraciones SQL
  functions/           Edge Functions (Deno)
    _shared/           Helpers compartidos (firma HikCentral)
    hik-sync-checadas/ Pull periódico de checadas
    hik-create-person/ Alta automática de persona en HCC
    hik-webhook/       Recepción push de eventos
```

## Roadmap

- [x] Scaffolding + esquema DB inicial
- [ ] Auth + roles (admin_rh, gerente, empleado)
- [ ] CRUD empleados + foto + sucursales + puestos
- [ ] Documentos con Storage + alertas de vencimiento
- [ ] Notas / bitácora por empleado
- [ ] Integración HikCentral Connect (alta persona + pull + webhook)
- [ ] Motor de cálculo de nómina (ISR, IMSS, conceptos recurrentes)
- [ ] Recibos de nómina PDF
- [ ] Reportes: asistencia, rotación, vencimientos, nómina
- [ ] Dashboard con KPIs
