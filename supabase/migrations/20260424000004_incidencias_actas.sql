-- ============================================================
-- Incidencias y Actas administrativas
-- ============================================================

-- ------------------------------------------------------------
-- Incidencias (eventos que afectan asistencia/nómina)
-- ------------------------------------------------------------
create type tipo_incidencia as enum (
  'permiso_con_goce',
  'permiso_sin_goce',
  'vacaciones',
  'incapacidad_imss',
  'incapacidad_privada',
  'falta_justificada',
  'falta_injustificada',
  'retardo_justificado',
  'cambio_turno',
  'hora_extra',
  'descanso_laborado',
  'otro'
);

create type estatus_incidencia as enum ('registrada', 'aprobada', 'rechazada', 'aplicada');

create table incidencias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo tipo_incidencia not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  dias numeric(5, 2) generated always as ((fecha_fin - fecha_inicio) + 1) stored,
  horas numeric(5, 2),
  afecta_sueldo boolean not null default true,
  afecta_asistencia boolean not null default true,
  monto_override numeric(12, 2),
  descripcion text,
  folio_imss text,
  documento_path text,
  estatus estatus_incidencia not null default 'registrada',
  created_at timestamptz not null default now(),
  created_by uuid,
  aprobada_by uuid,
  aprobada_at timestamptz,
  rechazada_by uuid,
  rechazada_at timestamptz,
  motivo_rechazo text
);

create index idx_incidencias_empleado on incidencias(empleado_id, fecha_inicio desc);
create index idx_incidencias_estatus on incidencias(estatus);
create index idx_incidencias_rango on incidencias(fecha_inicio, fecha_fin);

-- ------------------------------------------------------------
-- Actas administrativas (acciones disciplinarias)
-- ------------------------------------------------------------
create type tipo_acta as enum (
  'amonestacion_verbal',
  'amonestacion_escrita',
  'acta_administrativa',
  'suspension',
  'rescision'
);

-- Secuencia para folios
create sequence acta_folio_seq start 1;

create table actas_administrativas (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique default ('ACTA-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('acta_folio_seq')::text, 5, '0')),
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo tipo_acta not null,
  fecha date not null default current_date,
  hora time default (now() at time zone 'America/Mexico_City')::time,
  lugar text,
  hechos text not null,
  articulo_infringido text,
  consecuencia text,
  dias_suspension int,
  testigos jsonb default '[]'::jsonb,
  firmada_por_empleado boolean not null default false,
  negado_firmar boolean not null default false,
  documento_path text,
  notificada_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  cancelada_at timestamptz,
  cancelada_by uuid,
  motivo_cancelacion text
);

create index idx_actas_empleado on actas_administrativas(empleado_id, fecha desc);
create index idx_actas_tipo on actas_administrativas(tipo);

-- ------------------------------------------------------------
-- Bucket de storage para PDFs de actas e incidencias (privado)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('actas-incidencias', 'actas-incidencias', false)
on conflict (id) do nothing;

drop policy if exists "actas auth all" on storage.objects;
create policy "actas auth all" on storage.objects
  for all to authenticated
  using (bucket_id = 'actas-incidencias')
  with check (bucket_id = 'actas-incidencias');

-- ------------------------------------------------------------
-- Vista: resumen por empleado (para pestañas del expediente)
-- ------------------------------------------------------------
create or replace view v_empleado_resumen as
select
  e.id as empleado_id,
  (select count(*) from notas n where n.empleado_id = e.id) as total_notas,
  (select count(*) from incidencias i where i.empleado_id = e.id) as total_incidencias,
  (select count(*) from actas_administrativas a where a.empleado_id = e.id) as total_actas,
  (select count(*) from documentos d where d.empleado_id = e.id) as total_documentos,
  (select count(*) from documentos d where d.empleado_id = e.id
     and d.fecha_vencimiento is not null
     and d.fecha_vencimiento <= current_date + interval '30 days') as docs_por_vencer
from empleados e;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table incidencias             enable row level security;
alter table actas_administrativas   enable row level security;

drop policy if exists "auth all" on incidencias;
create policy "auth all" on incidencias for all to authenticated using (true) with check (true);

drop policy if exists "auth all" on actas_administrativas;
create policy "auth all" on actas_administrativas for all to authenticated using (true) with check (true);
