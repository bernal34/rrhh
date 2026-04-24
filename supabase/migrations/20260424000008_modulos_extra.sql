-- ============================================================
-- Módulos extra: organigrama (jefe_id), capacitación, onboarding/offboarding,
-- bitácora de auditoría, y actualización de mis_modulos.
-- ============================================================

-- ------------------------------------------------------------
-- Organigrama: agregar jefe_id a empleados
-- ------------------------------------------------------------
alter table empleados add column if not exists jefe_id uuid references empleados(id) on delete set null;
create index if not exists idx_empleados_jefe on empleados(jefe_id);

-- ------------------------------------------------------------
-- Capacitación
-- ------------------------------------------------------------
create table if not exists capacitaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tema text,
  tipo text,                   -- ej. 'NOM-035', 'Inducción', 'Seguridad', 'Técnico'
  fecha date not null,
  duracion_horas numeric(5, 1) not null default 0,
  instructor text,
  lugar text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists capacitacion_asistentes (
  capacitacion_id uuid not null references capacitaciones(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  acreditado boolean not null default true,
  calificacion numeric(5, 2),
  notas text,
  primary key (capacitacion_id, empleado_id)
);

create index if not exists idx_capacitacion_empleado on capacitacion_asistentes(empleado_id);

-- ------------------------------------------------------------
-- Onboarding / Offboarding (catálogo de items + checklist por empleado)
-- ------------------------------------------------------------
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  flujo text not null check (flujo in ('onboarding', 'offboarding')),
  orden int not null default 100,
  titulo text not null,
  descripcion text,
  obligatorio boolean not null default true,
  activo boolean not null default true
);

create table if not exists empleado_checklist (
  empleado_id uuid not null references empleados(id) on delete cascade,
  item_id uuid not null references checklist_items(id) on delete cascade,
  cumplido boolean not null default false,
  cumplido_at timestamptz,
  cumplido_por uuid,
  notas text,
  primary key (empleado_id, item_id)
);

create index if not exists idx_empleado_checklist on empleado_checklist(empleado_id);

-- Seed mínimo de checklist
insert into checklist_items (flujo, orden, titulo, obligatorio) values
  ('onboarding', 10, 'Contrato firmado', true),
  ('onboarding', 20, 'Alta IMSS', true),
  ('onboarding', 30, 'Asignación de equipo / uniformes', false),
  ('onboarding', 40, 'Accesos a sistemas', true),
  ('onboarding', 50, 'Inducción RH', true),
  ('onboarding', 60, 'Curso de seguridad', true),
  ('offboarding', 10, 'Carta renuncia / acta', true),
  ('offboarding', 20, 'Devolución de equipo', true),
  ('offboarding', 30, 'Baja IMSS', true),
  ('offboarding', 40, 'Cierre de accesos', true),
  ('offboarding', 50, 'Pago finiquito', true),
  ('offboarding', 60, 'Recibo de finiquito firmado', true)
on conflict do nothing;

-- ------------------------------------------------------------
-- Bitácora de auditoría
-- ------------------------------------------------------------
create table if not exists bitacora_auditoria (
  id bigserial primary key,
  ts timestamptz not null default now(),
  user_id uuid,
  user_email text,
  tabla text not null,
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,
  cambios jsonb
);

create index if not exists idx_bitacora_ts on bitacora_auditoria(ts desc);
create index if not exists idx_bitacora_tabla on bitacora_auditoria(tabla);

create or replace function fn_bitacora_trigger() returns trigger
language plpgsql security definer
as $$
declare
  v_uid uuid;
  v_email text;
  v_id text;
  v_cambios jsonb;
begin
  v_uid := auth.uid();
  begin
    select email into v_email from auth.users where id = v_uid;
  exception when others then
    v_email := null;
  end;

  if tg_op = 'DELETE' then
    v_id := coalesce((to_jsonb(old)->>'id'), '');
    v_cambios := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    v_cambios := to_jsonb(new);
  else
    v_id := coalesce((to_jsonb(new)->>'id'), '');
    v_cambios := jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new));
  end if;

  insert into bitacora_auditoria(user_id, user_email, tabla, operacion, registro_id, cambios)
  values (v_uid, v_email, tg_table_name, tg_op, v_id, v_cambios);
  return coalesce(new, old);
end $$;

-- Aplica triggers en tablas sensibles
do $$
declare
  t text;
  tablas text[] := array['empleados','sucursales','puestos','incidencias',
                          'actas_administrativas','periodos_nomina','prenomina',
                          'usuarios_modulos','usuarios_rol'];
begin
  foreach t in array tablas loop
    if exists(select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_bitacora on %I', t);
      execute format('create trigger trg_bitacora after insert or update or delete on %I for each row execute function fn_bitacora_trigger()', t);
    end if;
  end loop;
end $$;

alter table bitacora_auditoria enable row level security;
drop policy if exists "bitacora admin" on bitacora_auditoria;
create policy "bitacora admin" on bitacora_auditoria
  for select to authenticated using (current_user_es_admin() or current_user_puede_ver('auditoria'));

-- ------------------------------------------------------------
-- Aguinaldo y PTU (vistas calculadas)
-- ------------------------------------------------------------
-- Aguinaldo: mínimo 15 días de salario por año proporcional al tiempo trabajado.
create or replace view aguinaldo_proyectado as
with sueldo_actual as (
  select distinct on (empleado_id) empleado_id, sueldo_base, vigente_desde
    from empleado_sueldo
   order by empleado_id, vigente_desde desc
)
select e.id as empleado_id,
       e.nombre, e.apellido_paterno, e.apellido_materno, e.codigo, e.sucursal_id,
       e.fecha_ingreso,
       coalesce(s.sueldo_base, 0) as sueldo_mensual,
       (coalesce(s.sueldo_base, 0) / 30.0) as salario_diario,
       -- días trabajados en el año actual (max 365)
       least(
         extract(day from current_date - greatest(e.fecha_ingreso, date_trunc('year', current_date)::date))::int + 1,
         365
       ) as dias_trabajados_anio,
       -- aguinaldo proporcional = (días_trabajados * 15) / 365 * salario_diario
       round(
         (least(extract(day from current_date - greatest(e.fecha_ingreso, date_trunc('year', current_date)::date))::int + 1, 365) * 15.0)
         / 365.0 * (coalesce(s.sueldo_base, 0) / 30.0),
         2
       ) as aguinaldo_proporcional,
       -- aguinaldo completo (15 días) si trabajó todo el año
       round(15.0 * (coalesce(s.sueldo_base, 0) / 30.0), 2) as aguinaldo_completo_15dias
  from empleados e
  left join sueldo_actual s on s.empleado_id = e.id
 where e.estatus in ('activo','permiso','vacaciones');

grant select on aguinaldo_proyectado to authenticated;

-- ------------------------------------------------------------
-- Actualizar mis_modulos para incluir nuevos módulos
-- ------------------------------------------------------------
create or replace view mis_modulos as
  select modulo, puede_editar
    from usuarios_modulos
    where user_id = auth.uid()
  union all
  select unnest(array['empleados','sucursales','puestos','horarios',
                       'asistencia','incidencias','vacaciones','actas','nomina','documentos',
                       'reportes','usuarios','capacitacion','onboarding','calculadoras',
                       'calendario','organigrama','auditoria']) as modulo,
         true as puede_editar
    where current_user_es_admin();
