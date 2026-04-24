-- ============================================================
-- MIGRACIONES COMBINADAS - Portal RRHH
-- Generado: 2026-04-24
-- Aplicar en SQL Editor de Supabase de un solo run
-- ============================================================


-- ============================================================
-- 20260424000001_initial_schema.sql
-- ============================================================

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


-- ============================================================
-- 20260424000002_auth_storage_rls.sql
-- ============================================================

-- ============================================================
-- Buckets de Storage y políticas RLS básicas
-- ============================================================

-- ------------------------------------------------------------
-- Buckets
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('empleados-fotos', 'empleados-fotos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('empleados-docs', 'empleados-docs', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Policies sobre storage.objects
-- ------------------------------------------------------------
drop policy if exists "fotos public read" on storage.objects;
create policy "fotos public read" on storage.objects
  for select using (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth write" on storage.objects;
create policy "fotos auth write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth update" on storage.objects;
create policy "fotos auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth delete" on storage.objects;
create policy "fotos auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'empleados-fotos');

drop policy if exists "docs auth all" on storage.objects;
create policy "docs auth all" on storage.objects
  for all to authenticated
  using (bucket_id = 'empleados-docs')
  with check (bucket_id = 'empleados-docs');

-- ------------------------------------------------------------
-- Helper: rol del usuario actual
-- ------------------------------------------------------------
create or replace function current_user_rol() returns rol_rrhh
  language sql stable security definer
as $$
  select rol from usuarios_rol where user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- RLS en tablas del dominio (MVP: cualquier usuario autenticado)
-- Endurecer por rol más adelante usando current_user_rol()
-- ------------------------------------------------------------
alter table sucursales                  enable row level security;
alter table puestos                     enable row level security;
alter table empleados                   enable row level security;
alter table empleado_sueldo             enable row level security;
alter table conceptos_nomina            enable row level security;
alter table empleado_conceptos          enable row level security;
alter table periodos_nomina             enable row level security;
alter table nomina_detalle              enable row level security;
alter table nomina_conceptos_aplicados  enable row level security;
alter table documentos                  enable row level security;
alter table notas                       enable row level security;
alter table checadas                    enable row level security;
alter table integracion_hikvision       enable row level security;
alter table empleado_hikvision_map      enable row level security;
alter table sucursal_hikvision_map      enable row level security;
alter table usuarios_rol                enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'sucursales','puestos','empleados','empleado_sueldo','conceptos_nomina',
    'empleado_conceptos','periodos_nomina','nomina_detalle','nomina_conceptos_aplicados',
    'documentos','notas','checadas','empleado_hikvision_map','sucursal_hikvision_map'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists "auth all" on %I;
       create policy "auth all" on %I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- Tabla de integración: solo admin_rh
drop policy if exists "integracion admin" on integracion_hikvision;
create policy "integracion admin" on integracion_hikvision
  for all to authenticated
  using (current_user_rol() = 'admin_rh')
  with check (current_user_rol() = 'admin_rh');

-- usuarios_rol: cada quien ve su propio registro; admin_rh ve todos
drop policy if exists "usuarios_rol self" on usuarios_rol;
create policy "usuarios_rol self" on usuarios_rol
  for select to authenticated
  using (user_id = auth.uid() or current_user_rol() = 'admin_rh');

drop policy if exists "usuarios_rol admin write" on usuarios_rol;
create policy "usuarios_rol admin write" on usuarios_rol
  for all to authenticated
  using (current_user_rol() = 'admin_rh')
  with check (current_user_rol() = 'admin_rh');


-- ============================================================
-- 20260424000003_horarios_prenomina.sql
-- ============================================================

-- ============================================================
-- Horarios, asistencia computada, bonos y prenómina con autorizaciones
-- ============================================================

-- ------------------------------------------------------------
-- Turnos (plantilla de horario)
-- ------------------------------------------------------------
create table turnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  hora_entrada time not null,
  hora_salida time not null,
  cruza_medianoche boolean generated always as (hora_salida <= hora_entrada) stored,
  tolerancia_retardo_min int not null default 10,
  tolerancia_falta_min int not null default 60,
  color text default '#6366f1',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Grupos de horario (p.ej. 'Matutino Sucursal A', 'Cocina Noche')
-- ------------------------------------------------------------
create table grupos_horario (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  sucursal_id uuid references sucursales(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qué turno aplica a cada día de la semana (0=dom..6=sab). turno_id null = descanso.
create table grupo_turno_dia (
  grupo_id uuid not null references grupos_horario(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  turno_id uuid references turnos(id),
  primary key (grupo_id, dia_semana)
);

-- ------------------------------------------------------------
-- Asignación empleado -> grupo (con vigencias)
-- ------------------------------------------------------------
create table empleado_grupo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  grupo_id uuid not null references grupos_horario(id),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now()
);
create index idx_emp_grupo on empleado_grupo(empleado_id, vigente_desde desc);

-- Override de turno puntual (día específico, ej. cubre turno ajeno)
create table empleado_turno_override (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_id uuid references turnos(id),  -- null = descanso forzado
  nota text,
  unique (empleado_id, fecha)
);

-- ------------------------------------------------------------
-- Asistencia consolidada por día (resultado de checadas vs turno esperado)
-- ------------------------------------------------------------
create table asistencia_dia (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_id uuid references turnos(id),
  hora_entrada_esperada time,
  hora_salida_esperada time,
  entrada_real timestamptz,
  salida_real timestamptz,
  minutos_retardo int default 0,
  minutos_trabajados int,
  horas_extra numeric(5, 2) default 0,
  falta boolean not null default false,
  incidencia text,                                   -- permiso, vacaciones, incapacidad
  bloqueado boolean not null default false,          -- true cuando ya está en prenómina autorizada
  recalculado_at timestamptz not null default now(),
  unique (empleado_id, fecha)
);
create index idx_asistencia_fecha on asistencia_dia(fecha desc);
create index idx_asistencia_empleado on asistencia_dia(empleado_id, fecha desc);

-- ------------------------------------------------------------
-- Reglas de bonos (ligan un concepto_nomina con una regla de cálculo)
-- ------------------------------------------------------------
create type tipo_regla_bono as enum ('puntualidad', 'asistencia', 'fijo');

create table reglas_bono (
  id uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references conceptos_nomina(id),
  nombre text not null,
  tipo tipo_regla_bono not null,
  monto numeric(12, 2) not null default 0,
  max_retardos_permitidos int default 0,
  max_faltas_permitidas int default 0,
  aplica_sucursal_id uuid references sucursales(id),   -- null = todas
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Prenómina (cabecera con flujo de autorización)
-- ------------------------------------------------------------
create type estatus_prenomina as enum (
  'borrador', 'en_revision', 'autorizada', 'cancelada', 'convertida'
);

create table prenomina (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references periodos_nomina(id),
  sucursal_id uuid references sucursales(id),
  estatus estatus_prenomina not null default 'borrador',
  total_percepciones numeric(14, 2) default 0,
  total_deducciones numeric(14, 2) default 0,
  total_neto numeric(14, 2) default 0,
  num_empleados int default 0,
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid,
  enviada_revision_at timestamptz,
  enviada_revision_by uuid,
  autorizada_at timestamptz,
  autorizada_by uuid,
  cancelada_at timestamptz,
  cancelada_by uuid,
  motivo_cancelacion text
);

-- Enlace nomina_detalle -> prenomina + estado propio
alter table nomina_detalle add column prenomina_id uuid references prenomina(id) on delete set null;

-- ------------------------------------------------------------
-- Función: fn_compute_asistencia_rango
-- Recalcula asistencia_dia para un rango de fechas. Respeta `bloqueado`.
-- ------------------------------------------------------------
create or replace function fn_compute_asistencia_rango(
  p_desde date,
  p_hasta date,
  p_empleado_id uuid default null
) returns int
language plpgsql
as $$
declare
  r_emp record;
  r_fecha date;
  v_turno_id uuid;
  v_turno record;
  v_entrada timestamptz;
  v_salida timestamptz;
  v_retardo int;
  v_trabajados int;
  v_falta boolean;
  v_count int := 0;
begin
  for r_emp in
    select id from empleados
    where estatus in ('activo','permiso','vacaciones')
      and (p_empleado_id is null or id = p_empleado_id)
  loop
    for r_fecha in select g::date from generate_series(p_desde, p_hasta, interval '1 day') g
    loop
      -- override puntual tiene prioridad
      select turno_id into v_turno_id
        from empleado_turno_override
        where empleado_id = r_emp.id and fecha = r_fecha;

      if not found then
        select gt.turno_id into v_turno_id
          from empleado_grupo eg
          join grupo_turno_dia gt on gt.grupo_id = eg.grupo_id
          where eg.empleado_id = r_emp.id
            and r_fecha >= eg.vigente_desde
            and r_fecha <= coalesce(eg.vigente_hasta, '9999-12-31'::date)
            and gt.dia_semana = extract(dow from r_fecha)
          order by eg.vigente_desde desc
          limit 1;
      end if;

      if v_turno_id is null then
        -- descanso: registra fila sin turno, falta = false
        insert into asistencia_dia (empleado_id, fecha, turno_id, falta)
        values (r_emp.id, r_fecha, null, false)
        on conflict (empleado_id, fecha) do update
          set turno_id = null,
              hora_entrada_esperada = null,
              hora_salida_esperada = null,
              falta = false,
              recalculado_at = now()
          where asistencia_dia.bloqueado = false;
        v_count := v_count + 1;
        continue;
      end if;

      select hora_entrada, hora_salida, tolerancia_retardo_min, tolerancia_falta_min
        into v_turno from turnos where id = v_turno_id;

      -- Checadas del día (ventana de 24h + margen para turnos nocturnos)
      select min(fecha_hora) into v_entrada
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= r_fecha::timestamptz
          and fecha_hora <  (r_fecha + interval '1 day')::timestamptz;

      select max(fecha_hora) into v_salida
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= r_fecha::timestamptz
          and fecha_hora <  (r_fecha + interval '2 day')::timestamptz;

      if v_entrada is null then
        v_retardo := null;
        v_falta := true;
        v_trabajados := null;
      else
        v_retardo := greatest(
          0,
          (extract(epoch from (v_entrada at time zone 'UTC')::time - v_turno.hora_entrada) / 60)::int
        );
        v_falta := v_retardo > v_turno.tolerancia_falta_min;
        if v_salida is not null and v_salida > v_entrada then
          v_trabajados := (extract(epoch from (v_salida - v_entrada)) / 60)::int;
        else
          v_trabajados := null;
        end if;
      end if;

      insert into asistencia_dia (
        empleado_id, fecha, turno_id,
        hora_entrada_esperada, hora_salida_esperada,
        entrada_real, salida_real,
        minutos_retardo, minutos_trabajados, falta
      ) values (
        r_emp.id, r_fecha, v_turno_id,
        v_turno.hora_entrada, v_turno.hora_salida,
        v_entrada, v_salida,
        coalesce(v_retardo, 0), v_trabajados, v_falta
      )
      on conflict (empleado_id, fecha) do update
      set turno_id = excluded.turno_id,
          hora_entrada_esperada = excluded.hora_entrada_esperada,
          hora_salida_esperada = excluded.hora_salida_esperada,
          entrada_real = excluded.entrada_real,
          salida_real = excluded.salida_real,
          minutos_retardo = excluded.minutos_retardo,
          minutos_trabajados = excluded.minutos_trabajados,
          falta = excluded.falta,
          recalculado_at = now()
        where asistencia_dia.bloqueado = false;

      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Función: fn_generar_prenomina
-- Genera prenómina para un periodo. Calcula sueldo, retardos, faltas, bonos,
-- conceptos recurrentes y guarda desglose en nomina_detalle.
-- ------------------------------------------------------------
create or replace function fn_generar_prenomina(
  p_periodo_id uuid,
  p_sucursal_id uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_periodo record;
  v_pre_id uuid;
  r_emp record;
  v_dias_periodo int;
  v_dias_trabajados numeric;
  v_faltas int;
  v_retardos int;
  v_minutos_retardo int;
  v_sueldo_diario numeric;
  v_sueldo_base numeric;
  v_descuento_falta numeric;
  v_descuento_retardo numeric;
  v_total_p numeric;
  v_total_d numeric;
  v_neto numeric;
  v_detalle_id uuid;
  r_bono record;
  r_conc_emp record;
  v_desglose jsonb;
  v_num_emp int := 0;
  v_tot_p numeric := 0;
  v_tot_d numeric := 0;
  v_tot_n numeric := 0;
begin
  select * into v_periodo from periodos_nomina where id = p_periodo_id;
  if v_periodo is null then
    raise exception 'Periodo % no existe', p_periodo_id;
  end if;

  v_dias_periodo := (v_periodo.fecha_fin - v_periodo.fecha_inicio) + 1;

  -- Asegura asistencia calculada en el rango
  perform fn_compute_asistencia_rango(v_periodo.fecha_inicio, v_periodo.fecha_fin, null);

  -- Cabecera prenómina
  insert into prenomina (periodo_id, sucursal_id, estatus, created_by)
  values (p_periodo_id, p_sucursal_id, 'borrador', auth.uid())
  returning id into v_pre_id;

  for r_emp in
    select e.id, e.sucursal_id,
           concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) as nombre_full
      from empleados e
      where e.estatus = 'activo'
        and (p_sucursal_id is null or e.sucursal_id = p_sucursal_id)
  loop
    -- Sueldo vigente al inicio del periodo
    select sueldo_diario into v_sueldo_diario
      from empleado_sueldo
      where empleado_id = r_emp.id
        and vigente_desde <= v_periodo.fecha_inicio
        and (vigente_hasta is null or vigente_hasta >= v_periodo.fecha_inicio)
      order by vigente_desde desc
      limit 1;

    if v_sueldo_diario is null then
      v_sueldo_diario := 0;
    end if;

    -- Métricas desde asistencia_dia
    select
      coalesce(sum(case when turno_id is not null and not falta then 1 else 0 end), 0),
      coalesce(sum(case when falta then 1 else 0 end), 0),
      coalesce(sum(case when minutos_retardo > 0 then 1 else 0 end), 0),
      coalesce(sum(minutos_retardo), 0)
    into v_dias_trabajados, v_faltas, v_retardos, v_minutos_retardo
    from asistencia_dia
    where empleado_id = r_emp.id
      and fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    v_sueldo_base := round(v_sueldo_diario * v_dias_trabajados, 2);
    v_descuento_falta := round(v_sueldo_diario * v_faltas, 2);
    -- Descuento por minutos de retardo (proporcional a jornada 8h)
    v_descuento_retardo := round((v_sueldo_diario / 8.0 / 60.0) * v_minutos_retardo, 2);

    v_total_p := v_sueldo_base;
    v_total_d := v_descuento_falta + v_descuento_retardo;

    v_desglose := jsonb_build_object(
      'dias_periodo', v_dias_periodo,
      'dias_trabajados', v_dias_trabajados,
      'faltas', v_faltas,
      'retardos', v_retardos,
      'minutos_retardo', v_minutos_retardo,
      'sueldo_diario', v_sueldo_diario,
      'sueldo_base', v_sueldo_base,
      'descuento_faltas', v_descuento_falta,
      'descuento_retardos', v_descuento_retardo,
      'conceptos', '[]'::jsonb
    );

    -- Detalle
    insert into nomina_detalle (
      periodo_id, prenomina_id, empleado_id,
      dias_trabajados, faltas, retardos,
      total_percepciones, total_deducciones, neto_pagar, desglose
    ) values (
      p_periodo_id, v_pre_id, r_emp.id,
      v_dias_trabajados, v_faltas, v_retardos,
      0, 0, 0, v_desglose
    ) returning id into v_detalle_id;

    -- Conceptos: sueldo base
    insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
    select v_detalle_id, id, v_sueldo_base, true
      from conceptos_nomina where clave = 'SUELDO';

    if v_descuento_falta > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_descuento_falta, false
        from conceptos_nomina where clave = 'FALTAS';
    end if;

    -- Bonos según reglas
    for r_bono in
      select rb.*, cn.clave from reglas_bono rb
      join conceptos_nomina cn on cn.id = rb.concepto_id
      where rb.activo = true
        and (rb.aplica_sucursal_id is null or rb.aplica_sucursal_id = r_emp.sucursal_id)
    loop
      if r_bono.tipo = 'puntualidad' and v_retardos <= coalesce(r_bono.max_retardos_permitidos, 0) then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      elsif r_bono.tipo = 'asistencia' and v_faltas <= coalesce(r_bono.max_faltas_permitidas, 0) then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      elsif r_bono.tipo = 'fijo' then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      end if;
    end loop;

    -- Conceptos recurrentes asignados al empleado (aditivas/deducciones fijas)
    for r_conc_emp in
      select ec.*, cn.tipo, coalesce(ec.monto_override, cn.valor) as monto
        from empleado_conceptos ec
        join conceptos_nomina cn on cn.id = ec.concepto_id
        where ec.empleado_id = r_emp.id
          and ec.vigente_desde <= v_periodo.fecha_fin
          and (ec.vigente_hasta is null or ec.vigente_hasta >= v_periodo.fecha_inicio)
    loop
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      values (v_detalle_id, r_conc_emp.concepto_id, coalesce(r_conc_emp.monto, 0),
              r_conc_emp.tipo = 'percepcion');

      if r_conc_emp.tipo = 'percepcion' then
        v_total_p := v_total_p + coalesce(r_conc_emp.monto, 0);
      else
        v_total_d := v_total_d + coalesce(r_conc_emp.monto, 0);
      end if;
    end loop;

    v_neto := v_total_p - v_total_d;

    update nomina_detalle
      set total_percepciones = v_total_p,
          total_deducciones = v_total_d,
          neto_pagar = v_neto
      where id = v_detalle_id;

    v_num_emp := v_num_emp + 1;
    v_tot_p := v_tot_p + v_total_p;
    v_tot_d := v_tot_d + v_total_d;
    v_tot_n := v_tot_n + v_neto;
  end loop;

  update prenomina
    set num_empleados = v_num_emp,
        total_percepciones = v_tot_p,
        total_deducciones = v_tot_d,
        total_neto = v_tot_n
    where id = v_pre_id;

  return v_pre_id;
end;
$$;

-- ------------------------------------------------------------
-- Función: fn_autorizar_prenomina / fn_cancelar_prenomina
-- ------------------------------------------------------------
create or replace function fn_autorizar_prenomina(p_pre_id uuid) returns void
language plpgsql
as $$
declare v_pre record;
begin
  select * into v_pre from prenomina where id = p_pre_id;
  if v_pre is null then raise exception 'Prenómina no existe'; end if;
  if v_pre.estatus not in ('en_revision','borrador') then
    raise exception 'Estatus % no autorizable', v_pre.estatus;
  end if;

  update prenomina
    set estatus = 'autorizada',
        autorizada_at = now(),
        autorizada_by = auth.uid()
    where id = p_pre_id;

  -- Bloquea asistencia del periodo para evitar recálculos accidentales
  update asistencia_dia ad
    set bloqueado = true
    from nomina_detalle nd
    join periodos_nomina pn on pn.id = nd.periodo_id
    where nd.prenomina_id = p_pre_id
      and ad.empleado_id = nd.empleado_id
      and ad.fecha between pn.fecha_inicio and pn.fecha_fin;
end;
$$;

create or replace function fn_cancelar_prenomina(p_pre_id uuid, p_motivo text) returns void
language plpgsql
as $$
begin
  update prenomina
    set estatus = 'cancelada',
        cancelada_at = now(),
        cancelada_by = auth.uid(),
        motivo_cancelacion = p_motivo
    where id = p_pre_id
      and estatus in ('borrador','en_revision');
  if not found then raise exception 'No se pudo cancelar (estatus inválido)'; end if;
end;
$$;

-- ------------------------------------------------------------
-- RLS: autenticados (endurecer por rol admin_rh después)
-- ------------------------------------------------------------
alter table turnos                    enable row level security;
alter table grupos_horario            enable row level security;
alter table grupo_turno_dia           enable row level security;
alter table empleado_grupo            enable row level security;
alter table empleado_turno_override   enable row level security;
alter table asistencia_dia            enable row level security;
alter table reglas_bono               enable row level security;
alter table prenomina                 enable row level security;

do $$
declare
  t text;
  tables text[] := array['turnos','grupos_horario','grupo_turno_dia','empleado_grupo',
                         'empleado_turno_override','asistencia_dia','reglas_bono','prenomina'];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists "auth all" on %I;
       create policy "auth all" on %I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Vista: reporte asistencia diario (para reportes)
-- ------------------------------------------------------------
create or replace view v_reporte_asistencia as
select
  ad.fecha,
  e.id as empleado_id,
  concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) as empleado,
  e.codigo,
  s.nombre as sucursal,
  t.nombre as turno,
  ad.hora_entrada_esperada,
  ad.hora_salida_esperada,
  ad.entrada_real,
  ad.salida_real,
  ad.minutos_retardo,
  ad.minutos_trabajados,
  ad.falta,
  ad.incidencia,
  case
    when ad.turno_id is null then 'descanso'
    when ad.falta then 'falta'
    when ad.minutos_retardo > 0 then 'retardo'
    when ad.entrada_real is not null then 'puntual'
    else 'pendiente'
  end as estatus
from asistencia_dia ad
join empleados e on e.id = ad.empleado_id
left join sucursales s on s.id = e.sucursal_id
left join turnos t on t.id = ad.turno_id;


-- ============================================================
-- 20260424000004_incidencias_actas.sql
-- ============================================================

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


-- ============================================================
-- 20260424000005_incidencias_en_asistencia.sql
-- ============================================================

-- ============================================================
-- Integrar incidencias aprobadas al cálculo de asistencia y prenómina
-- ============================================================

-- Redefine fn_compute_asistencia_rango para respetar incidencias aprobadas:
--   - afecta_asistencia = false  -> el día no cuenta como falta
--   - afecta_sueldo    = false  -> el día se paga aunque no haya checada
-- Para que prenómina use esta info, asistencia_dia.incidencia guarda el tipo.

create or replace function fn_compute_asistencia_rango(
  p_desde date,
  p_hasta date,
  p_empleado_id uuid default null
) returns int
language plpgsql
as $$
declare
  r_emp record;
  r_fecha date;
  v_turno_id uuid;
  v_turno record;
  v_entrada timestamptz;
  v_salida timestamptz;
  v_retardo int;
  v_trabajados int;
  v_falta boolean;
  v_incidencia record;
  v_incidencia_tipo text;
  v_count int := 0;
begin
  for r_emp in
    select id from empleados
    where estatus in ('activo','permiso','vacaciones')
      and (p_empleado_id is null or id = p_empleado_id)
  loop
    for r_fecha in select g::date from generate_series(p_desde, p_hasta, interval '1 day') g
    loop
      -- ¿Incidencia aprobada cubre este día?
      select tipo, afecta_sueldo, afecta_asistencia
        into v_incidencia
        from incidencias
        where empleado_id = r_emp.id
          and estatus in ('aprobada','aplicada')
          and r_fecha between fecha_inicio and fecha_fin
        order by created_at desc
        limit 1;

      v_incidencia_tipo := v_incidencia.tipo;

      -- Resolver turno (override -> grupo)
      select turno_id into v_turno_id
        from empleado_turno_override
        where empleado_id = r_emp.id and fecha = r_fecha;

      if not found then
        select gt.turno_id into v_turno_id
          from empleado_grupo eg
          join grupo_turno_dia gt on gt.grupo_id = eg.grupo_id
          where eg.empleado_id = r_emp.id
            and r_fecha >= eg.vigente_desde
            and r_fecha <= coalesce(eg.vigente_hasta, '9999-12-31'::date)
            and gt.dia_semana = extract(dow from r_fecha)
          order by eg.vigente_desde desc
          limit 1;
      end if;

      if v_turno_id is null then
        insert into asistencia_dia (empleado_id, fecha, turno_id, falta, incidencia)
        values (r_emp.id, r_fecha, null, false, v_incidencia_tipo)
        on conflict (empleado_id, fecha) do update
          set turno_id = null,
              hora_entrada_esperada = null,
              hora_salida_esperada = null,
              falta = false,
              incidencia = v_incidencia_tipo,
              recalculado_at = now()
          where asistencia_dia.bloqueado = false;
        v_count := v_count + 1;
        continue;
      end if;

      select hora_entrada, hora_salida, tolerancia_retardo_min, tolerancia_falta_min
        into v_turno from turnos where id = v_turno_id;

      select min(fecha_hora) into v_entrada
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= r_fecha::timestamptz
          and fecha_hora <  (r_fecha + interval '1 day')::timestamptz;

      select max(fecha_hora) into v_salida
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= r_fecha::timestamptz
          and fecha_hora <  (r_fecha + interval '2 day')::timestamptz;

      if v_entrada is null then
        v_retardo := null;
        v_falta := true;
        v_trabajados := null;
      else
        v_retardo := greatest(
          0,
          (extract(epoch from (v_entrada at time zone 'UTC')::time - v_turno.hora_entrada) / 60)::int
        );
        v_falta := v_retardo > v_turno.tolerancia_falta_min;
        if v_salida is not null and v_salida > v_entrada then
          v_trabajados := (extract(epoch from (v_salida - v_entrada)) / 60)::int;
        else
          v_trabajados := null;
        end if;
      end if;

      -- Si la incidencia justifica (afecta_asistencia=false), limpia la falta
      if v_incidencia_tipo is not null and v_incidencia.afecta_asistencia = false then
        v_falta := false;
      end if;

      insert into asistencia_dia (
        empleado_id, fecha, turno_id,
        hora_entrada_esperada, hora_salida_esperada,
        entrada_real, salida_real,
        minutos_retardo, minutos_trabajados, falta, incidencia
      ) values (
        r_emp.id, r_fecha, v_turno_id,
        v_turno.hora_entrada, v_turno.hora_salida,
        v_entrada, v_salida,
        coalesce(v_retardo, 0), v_trabajados, v_falta, v_incidencia_tipo
      )
      on conflict (empleado_id, fecha) do update
      set turno_id = excluded.turno_id,
          hora_entrada_esperada = excluded.hora_entrada_esperada,
          hora_salida_esperada = excluded.hora_salida_esperada,
          entrada_real = excluded.entrada_real,
          salida_real = excluded.salida_real,
          minutos_retardo = excluded.minutos_retardo,
          minutos_trabajados = excluded.minutos_trabajados,
          falta = excluded.falta,
          incidencia = excluded.incidencia,
          recalculado_at = now()
        where asistencia_dia.bloqueado = false;

      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- ============================================================
-- Refina fn_generar_prenomina para:
--   - No deducir sueldo de días con incidencia cuyo afecta_sueldo = false
--   - Sumar horas extra de incidencias aprobadas tipo 'hora_extra'
-- ============================================================
create or replace function fn_generar_prenomina(
  p_periodo_id uuid,
  p_sucursal_id uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_periodo record;
  v_pre_id uuid;
  r_emp record;
  v_dias_periodo int;
  v_dias_trabajados numeric;
  v_dias_pagados numeric;
  v_faltas int;
  v_retardos int;
  v_minutos_retardo int;
  v_horas_extra numeric;
  v_sueldo_diario numeric;
  v_sueldo_base numeric;
  v_descuento_falta numeric;
  v_descuento_retardo numeric;
  v_monto_extra numeric;
  v_total_p numeric;
  v_total_d numeric;
  v_neto numeric;
  v_detalle_id uuid;
  r_bono record;
  r_conc_emp record;
  v_desglose jsonb;
  v_num_emp int := 0;
  v_tot_p numeric := 0;
  v_tot_d numeric := 0;
  v_tot_n numeric := 0;
begin
  select * into v_periodo from periodos_nomina where id = p_periodo_id;
  if v_periodo is null then
    raise exception 'Periodo % no existe', p_periodo_id;
  end if;

  v_dias_periodo := (v_periodo.fecha_fin - v_periodo.fecha_inicio) + 1;

  perform fn_compute_asistencia_rango(v_periodo.fecha_inicio, v_periodo.fecha_fin, null);

  insert into prenomina (periodo_id, sucursal_id, estatus, created_by)
  values (p_periodo_id, p_sucursal_id, 'borrador', auth.uid())
  returning id into v_pre_id;

  for r_emp in
    select e.id, e.sucursal_id
      from empleados e
      where e.estatus = 'activo'
        and (p_sucursal_id is null or e.sucursal_id = p_sucursal_id)
  loop
    select sueldo_diario into v_sueldo_diario
      from empleado_sueldo
      where empleado_id = r_emp.id
        and vigente_desde <= v_periodo.fecha_inicio
        and (vigente_hasta is null or vigente_hasta >= v_periodo.fecha_inicio)
      order by vigente_desde desc
      limit 1;

    if v_sueldo_diario is null then v_sueldo_diario := 0; end if;

    -- Días trabajados = días con turno asignado sin falta (incluye incidencias con goce)
    select
      coalesce(sum(case when turno_id is not null and not falta then 1 else 0 end), 0),
      coalesce(sum(case when falta then 1 else 0 end), 0),
      coalesce(sum(case when minutos_retardo > 0 then 1 else 0 end), 0),
      coalesce(sum(minutos_retardo), 0)
    into v_dias_trabajados, v_faltas, v_retardos, v_minutos_retardo
    from asistencia_dia
    where empleado_id = r_emp.id
      and fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    -- Días con incidencia de goce (se pagan aunque no hubo checada)
    select coalesce(sum(1), 0) into v_dias_pagados
    from asistencia_dia ad
    join incidencias i on i.empleado_id = ad.empleado_id
      and ad.fecha between i.fecha_inicio and i.fecha_fin
      and i.estatus in ('aprobada','aplicada')
      and i.afecta_sueldo = false
    where ad.empleado_id = r_emp.id
      and ad.fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    -- Horas extra aprobadas en el periodo
    select coalesce(sum(horas), 0) into v_horas_extra
    from incidencias
    where empleado_id = r_emp.id
      and tipo = 'hora_extra'
      and estatus in ('aprobada','aplicada')
      and fecha_inicio between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    v_sueldo_base := round(v_sueldo_diario * v_dias_trabajados, 2);
    v_descuento_falta := round(v_sueldo_diario * v_faltas, 2);
    v_descuento_retardo := round((v_sueldo_diario / 8.0 / 60.0) * v_minutos_retardo, 2);
    v_monto_extra := round((v_sueldo_diario / 8.0) * 2 * v_horas_extra, 2); -- doble por defecto

    v_total_p := v_sueldo_base + v_monto_extra;
    v_total_d := v_descuento_falta + v_descuento_retardo;

    v_desglose := jsonb_build_object(
      'dias_periodo', v_dias_periodo,
      'dias_trabajados', v_dias_trabajados,
      'dias_pagados_con_goce', v_dias_pagados,
      'faltas', v_faltas,
      'retardos', v_retardos,
      'minutos_retardo', v_minutos_retardo,
      'horas_extra', v_horas_extra,
      'sueldo_diario', v_sueldo_diario,
      'sueldo_base', v_sueldo_base,
      'monto_horas_extra', v_monto_extra,
      'descuento_faltas', v_descuento_falta,
      'descuento_retardos', v_descuento_retardo
    );

    insert into nomina_detalle (
      periodo_id, prenomina_id, empleado_id,
      dias_trabajados, faltas, retardos, horas_extra,
      total_percepciones, total_deducciones, neto_pagar, desglose
    ) values (
      p_periodo_id, v_pre_id, r_emp.id,
      v_dias_trabajados, v_faltas, v_retardos, v_horas_extra,
      0, 0, 0, v_desglose
    ) returning id into v_detalle_id;

    insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
    select v_detalle_id, id, v_sueldo_base, true
      from conceptos_nomina where clave = 'SUELDO';

    if v_monto_extra > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_monto_extra, true
        from conceptos_nomina where clave = 'HORAS_EXTRA';
    end if;

    if v_descuento_falta > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_descuento_falta, false
        from conceptos_nomina where clave = 'FALTAS';
    end if;

    -- Bonos por regla
    for r_bono in
      select rb.*, cn.clave from reglas_bono rb
      join conceptos_nomina cn on cn.id = rb.concepto_id
      where rb.activo = true
        and (rb.aplica_sucursal_id is null or rb.aplica_sucursal_id = r_emp.sucursal_id)
    loop
      if r_bono.tipo = 'puntualidad' and v_retardos <= coalesce(r_bono.max_retardos_permitidos, 0) then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      elsif r_bono.tipo = 'asistencia' and v_faltas <= coalesce(r_bono.max_faltas_permitidas, 0) then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      elsif r_bono.tipo = 'fijo' then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      end if;
    end loop;

    -- Conceptos recurrentes
    for r_conc_emp in
      select ec.*, cn.tipo, coalesce(ec.monto_override, cn.valor) as monto
        from empleado_conceptos ec
        join conceptos_nomina cn on cn.id = ec.concepto_id
        where ec.empleado_id = r_emp.id
          and ec.vigente_desde <= v_periodo.fecha_fin
          and (ec.vigente_hasta is null or ec.vigente_hasta >= v_periodo.fecha_inicio)
    loop
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      values (v_detalle_id, r_conc_emp.concepto_id, coalesce(r_conc_emp.monto, 0),
              r_conc_emp.tipo = 'percepcion');

      if r_conc_emp.tipo = 'percepcion' then
        v_total_p := v_total_p + coalesce(r_conc_emp.monto, 0);
      else
        v_total_d := v_total_d + coalesce(r_conc_emp.monto, 0);
      end if;
    end loop;

    v_neto := v_total_p - v_total_d;

    update nomina_detalle
      set total_percepciones = v_total_p,
          total_deducciones = v_total_d,
          neto_pagar = v_neto
      where id = v_detalle_id;

    v_num_emp := v_num_emp + 1;
    v_tot_p := v_tot_p + v_total_p;
    v_tot_d := v_tot_d + v_total_d;
    v_tot_n := v_tot_n + v_neto;
  end loop;

  update prenomina
    set num_empleados = v_num_emp,
        total_percepciones = v_tot_p,
        total_deducciones = v_tot_d,
        total_neto = v_tot_n
    where id = v_pre_id;

  -- Marca incidencias ya consideradas como 'aplicada'
  update incidencias
    set estatus = 'aplicada'
    where estatus = 'aprobada'
      and fecha_inicio between v_periodo.fecha_inicio and v_periodo.fecha_fin
      and (p_sucursal_id is null or empleado_id in (
        select id from empleados where sucursal_id = p_sucursal_id
      ));

  return v_pre_id;
end;
$$;

