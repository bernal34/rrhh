-- ============================================================
-- Portal RRHH - Esquema inicial
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Catálogos
-- ------------------------------------------------------------

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table puestos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  sueldo_base_sugerido numeric(12, 2),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Empleados
-- ------------------------------------------------------------

create type tipo_pago as enum ('semanal', 'quincenal', 'mensual');
create type estatus_empleado as enum ('activo', 'baja', 'permiso', 'vacaciones');

create table empleados (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                           -- número de empleado interno
  nombre text not null,
  apellido_paterno text,
  apellido_materno text,
  rfc text,
  curp text,
  nss text,
  fecha_nacimiento date,
  genero text,
  telefono text,
  email text,
  direccion text,
  sucursal_id uuid references sucursales(id),
  puesto_id uuid references puestos(id),
  fecha_ingreso date not null,
  fecha_baja date,
  motivo_baja text,
  estatus estatus_empleado not null default 'activo',
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_empleados_sucursal on empleados(sucursal_id);
create index idx_empleados_estatus on empleados(estatus);

-- Histórico de sueldos (para trazabilidad de aumentos)
create table empleado_sueldo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  sueldo_diario numeric(12, 2) not null,
  sueldo_mensual numeric(12, 2) generated always as (sueldo_diario * 30) stored,
  tipo_pago tipo_pago not null default 'quincenal',
  vigente_desde date not null,
  vigente_hasta date,
  nota text,
  created_at timestamptz not null default now()
);

create index idx_sueldo_empleado on empleado_sueldo(empleado_id, vigente_desde desc);

-- ------------------------------------------------------------
-- Nómina: conceptos (percepciones y deducciones)
-- ------------------------------------------------------------

create type tipo_concepto as enum ('percepcion', 'deduccion');
create type tipo_calculo as enum ('fijo', 'porcentaje', 'formula', 'automatico');

create table conceptos_nomina (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,                   -- p.ej. 'SUELDO', 'ISR', 'IMSS_OBRERO'
  nombre text not null,
  tipo tipo_concepto not null,
  calculo tipo_calculo not null default 'fijo',
  valor numeric(12, 4),                         -- fijo o % según tipo_calculo
  formula text,                                 -- expresión evaluable si calculo='formula'
  grava_isr boolean not null default false,
  grava_imss boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Conceptos recurrentes asignados a un empleado (aditivas/deducciones fijas)
create table empleado_conceptos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  concepto_id uuid not null references conceptos_nomina(id),
  monto_override numeric(12, 2),                -- si nulo, usa valor del concepto
  vigente_desde date not null default current_date,
  vigente_hasta date,
  nota text,
  created_at timestamptz not null default now()
);

create index idx_emp_conceptos on empleado_conceptos(empleado_id);

-- ------------------------------------------------------------
-- Periodos de nómina y detalle por empleado
-- ------------------------------------------------------------

create type estatus_periodo as enum ('abierto', 'calculado', 'pagado', 'cancelado');

create table periodos_nomina (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_pago not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  fecha_pago date,
  estatus estatus_periodo not null default 'abierto',
  sucursal_id uuid references sucursales(id),  -- nulo = todas
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table nomina_detalle (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references periodos_nomina(id) on delete cascade,
  empleado_id uuid not null references empleados(id),
  dias_trabajados numeric(5, 2) not null default 0,
  faltas numeric(5, 2) not null default 0,
  retardos int not null default 0,
  horas_extra numeric(6, 2) not null default 0,
  total_percepciones numeric(12, 2) not null default 0,
  total_deducciones numeric(12, 2) not null default 0,
  neto_pagar numeric(12, 2) not null default 0,
  desglose jsonb,                               -- snapshot del cálculo
  unique (periodo_id, empleado_id)
);

create index idx_nomina_detalle_empleado on nomina_detalle(empleado_id);

create table nomina_conceptos_aplicados (
  id uuid primary key default gen_random_uuid(),
  nomina_detalle_id uuid not null references nomina_detalle(id) on delete cascade,
  concepto_id uuid not null references conceptos_nomina(id),
  monto numeric(12, 2) not null,
  es_percepcion boolean not null
);

create index idx_nom_conc_detalle on nomina_conceptos_aplicados(nomina_detalle_id);

-- ------------------------------------------------------------
-- Documentos y notas
-- ------------------------------------------------------------

create table documentos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo text not null,                           -- contrato, INE, CURP, comprobante, ...
  nombre text not null,
  storage_path text not null,                   -- ruta en Supabase Storage
  fecha_emision date,
  fecha_vencimiento date,
  nota text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create index idx_docs_empleado on documentos(empleado_id);
create index idx_docs_vencimiento on documentos(fecha_vencimiento) where fecha_vencimiento is not null;

create type tipo_nota as enum ('incidencia', 'amonestacion', 'reconocimiento', 'general');

create table notas (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  tipo tipo_nota not null default 'general',
  titulo text,
  contenido text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index idx_notas_empleado on notas(empleado_id, created_at desc);

-- ------------------------------------------------------------
-- Asistencia (checadas sincronizadas desde HikCentral Connect)
-- ------------------------------------------------------------

create type tipo_checada as enum ('entrada', 'salida', 'desconocido');

create table checadas (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid references empleados(id),
  sucursal_id uuid references sucursales(id),
  fecha_hora timestamptz not null,
  tipo tipo_checada not null default 'desconocido',
  dispositivo text,                             -- serial o nombre del dispositivo HCC
  hik_event_id text unique,                     -- id del evento en HikCentral, idempotencia
  hik_person_id text,                           -- por si aún no está mapeado el empleado
  raw jsonb,                                    -- payload original
  created_at timestamptz not null default now()
);

create index idx_checadas_empleado_fecha on checadas(empleado_id, fecha_hora desc);
create index idx_checadas_fecha on checadas(fecha_hora desc);

-- ------------------------------------------------------------
-- Integración HikCentral Connect
-- ------------------------------------------------------------

create table integracion_hikvision (
  id uuid primary key default gen_random_uuid(),
  base_url text not null,
  api_key text not null,                        -- referencia a Vault recomendado
  api_secret text not null,
  webhook_secret text,
  ultimo_sync timestamptz,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table empleado_hikvision_map (
  empleado_id uuid primary key references empleados(id) on delete cascade,
  hik_person_id text not null unique,
  hik_org_index_code text,
  sync_pending boolean not null default false,
  last_sync_at timestamptz
);

create table sucursal_hikvision_map (
  sucursal_id uuid primary key references sucursales(id) on delete cascade,
  hik_site_index_code text not null unique
);

-- ------------------------------------------------------------
-- Roles y permisos básicos (Supabase Auth)
-- ------------------------------------------------------------

create type rol_rrhh as enum ('admin_rh', 'gerente', 'empleado');

create table usuarios_rol (
  user_id uuid primary key,                     -- auth.users.id
  rol rol_rrhh not null default 'empleado',
  empleado_id uuid references empleados(id),
  sucursales uuid[] default '{}',               -- sucursales permitidas para gerente
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Triggers: updated_at
-- ------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sucursales_updated before update on sucursales
  for each row execute function set_updated_at();
create trigger trg_empleados_updated before update on empleados
  for each row execute function set_updated_at();
create trigger trg_integracion_updated before update on integracion_hikvision
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Seed de conceptos de nómina estándar (MX)
-- ------------------------------------------------------------

insert into conceptos_nomina (clave, nombre, tipo, calculo, valor, grava_isr, grava_imss, orden) values
  ('SUELDO',        'Sueldo',                  'percepcion', 'automatico', null, true,  true,  10),
  ('HORAS_EXTRA',   'Horas extra',             'percepcion', 'automatico', null, true,  true,  20),
  ('PRIMA_DOM',     'Prima dominical',         'percepcion', 'automatico', null, true,  true,  30),
  ('BONO_PUNT',     'Bono puntualidad',        'percepcion', 'fijo',       0,    false, false, 40),
  ('VALES',         'Vales de despensa',       'percepcion', 'fijo',       0,    false, false, 50),
  ('COMISIONES',    'Comisiones',              'percepcion', 'fijo',       0,    true,  true,  60),
  ('ISR',           'ISR',                     'deduccion',  'automatico', null, false, false, 100),
  ('IMSS_OBRERO',   'IMSS (cuota obrera)',     'deduccion',  'automatico', null, false, false, 110),
  ('INFONAVIT',     'INFONAVIT',               'deduccion',  'fijo',       0,    false, false, 120),
  ('FONACOT',       'FONACOT',                 'deduccion',  'fijo',       0,    false, false, 130),
  ('PRESTAMO',      'Préstamo personal',       'deduccion',  'fijo',       0,    false, false, 140),
  ('FALTAS',        'Faltas',                  'deduccion',  'automatico', null, false, false, 150),
  ('PENSION_ALIM',  'Pensión alimenticia',     'deduccion',  'porcentaje', 0,    false, false, 160);
