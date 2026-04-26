-- ============================================================
-- Préstamos a empleados + NOM-035 (encuestas) + alertas
-- ============================================================

-- ------------------------------------------------------------
-- Préstamos a empleados (con descuento vía nómina)
-- ------------------------------------------------------------
create table if not exists prestamos (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  monto_total numeric(12, 2) not null,
  num_pagos int not null,
  monto_por_pago numeric(12, 2) not null,
  fecha_inicio date not null,
  motivo text,
  estatus text not null default 'activo' check (estatus in ('activo', 'liquidado', 'cancelado')),
  created_at timestamptz not null default now(),
  notas text
);

create table if not exists prestamo_pagos (
  id uuid primary key default gen_random_uuid(),
  prestamo_id uuid not null references prestamos(id) on delete cascade,
  fecha date not null,
  monto numeric(12, 2) not null,
  periodo_id uuid references periodos_nomina(id),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_prestamos_empleado on prestamos(empleado_id);
create index if not exists idx_prestamo_pagos on prestamo_pagos(prestamo_id);

-- Vista con saldo
create or replace view prestamos_con_saldo as
select p.*,
       coalesce((select sum(pp.monto) from prestamo_pagos pp where pp.prestamo_id = p.id), 0)::numeric as pagado,
       (p.monto_total - coalesce((select sum(pp.monto) from prestamo_pagos pp where pp.prestamo_id = p.id), 0))::numeric as saldo
  from prestamos p;

grant select on prestamos_con_saldo to authenticated;

alter table prestamos enable row level security;
alter table prestamo_pagos enable row level security;
drop policy if exists "modulo read" on prestamos;
drop policy if exists "modulo write" on prestamos;
create policy "modulo read" on prestamos for select to authenticated using (current_user_puede_ver('prestamos'));
create policy "modulo write" on prestamos for all to authenticated using (current_user_puede_editar('prestamos')) with check (current_user_puede_editar('prestamos'));
drop policy if exists "modulo read" on prestamo_pagos;
drop policy if exists "modulo write" on prestamo_pagos;
create policy "modulo read" on prestamo_pagos for select to authenticated using (current_user_puede_ver('prestamos'));
create policy "modulo write" on prestamo_pagos for all to authenticated using (current_user_puede_editar('prestamos')) with check (current_user_puede_editar('prestamos'));

-- ------------------------------------------------------------
-- NOM-035 (encuestas / aplicaciones)
-- ------------------------------------------------------------
create table if not exists nom035_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null default current_date,
  guia text not null check (guia in ('I', 'II', 'III')),
  -- Guía I: hasta 15 colaboradores · cuestionario 1
  -- Guía II: 16 a 50 · cuestionario 2
  -- Guía III: más de 50 · cuestionario 3
  puntaje_total int,
  nivel_riesgo text check (nivel_riesgo in ('nulo', 'bajo', 'medio', 'alto', 'muy_alto')),
  respuestas jsonb,
  acciones text,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nom035_empleado on nom035_aplicaciones(empleado_id);
create index if not exists idx_nom035_fecha on nom035_aplicaciones(fecha desc);

alter table nom035_aplicaciones enable row level security;
drop policy if exists "modulo read" on nom035_aplicaciones;
drop policy if exists "modulo write" on nom035_aplicaciones;
create policy "modulo read" on nom035_aplicaciones for select to authenticated using (current_user_puede_ver('nom035'));
create policy "modulo write" on nom035_aplicaciones for all to authenticated using (current_user_puede_editar('nom035')) with check (current_user_puede_editar('nom035'));

-- ------------------------------------------------------------
-- Vista consolidada de alertas/pendientes (para módulo Notificaciones)
-- ------------------------------------------------------------
create or replace view alertas_pendientes as
-- Documentos por vencer en próximos 30 días
select 'documento_vence' as tipo,
       d.id as ref_id,
       d.empleado_id,
       e.nombre || ' ' || coalesce(e.apellido_paterno, '') as empleado_nombre,
       d.tipo || ' · ' || d.nombre as titulo,
       d.fecha_vencimiento as fecha,
       (d.fecha_vencimiento - current_date)::int as dias,
       case when d.fecha_vencimiento < current_date then 'critico'
            when d.fecha_vencimiento - current_date <= 7 then 'alto'
            else 'medio' end as severidad
  from documentos d
  join empleados e on e.id = d.empleado_id
 where d.fecha_vencimiento is not null
   and d.fecha_vencimiento <= current_date + interval '30 days'
union all
-- Cumpleaños próximos (próximos 7 días)
select 'cumpleanos' as tipo,
       e.id, e.id,
       e.nombre || ' ' || coalesce(e.apellido_paterno, '') as empleado_nombre,
       'Cumpleaños' as titulo,
       (date_trunc('year', current_date) + (extract(doy from e.fecha_nacimiento)::int - 1) * interval '1 day')::date as fecha,
       null::int,
       'bajo'
  from empleados e
 where e.fecha_nacimiento is not null
   and e.estatus = 'activo'
   and extract(doy from e.fecha_nacimiento) between extract(doy from current_date) and extract(doy from current_date + interval '7 days')
union all
-- Incidencias registradas pendientes de aprobación
select 'incidencia_pendiente' as tipo,
       i.id, i.empleado_id,
       e.nombre || ' ' || coalesce(e.apellido_paterno, ''),
       'Incidencia: ' || i.tipo::text,
       i.fecha_inicio,
       (i.fecha_inicio - current_date)::int,
       case when i.fecha_inicio <= current_date then 'alto' else 'medio' end
  from incidencias i
  join empleados e on e.id = i.empleado_id
 where i.estatus = 'registrada'
union all
-- Vacaciones acumuladas excesivas (> 25 días)
select 'vacaciones_excesivas' as tipo,
       v.empleado_id, v.empleado_id,
       v.nombre || ' ' || coalesce(v.apellido_paterno, ''),
       'Saldo de vacaciones acumulado',
       null::date,
       (v.dias_ganados_total - v.dias_tomados)::int,
       'medio'
  from vacaciones_saldos v
 where v.dias_ganados_total - v.dias_tomados > 25;

grant select on alertas_pendientes to authenticated;

-- Actualizar mis_modulos para incluir nuevos módulos
create or replace view mis_modulos as
  select modulo, puede_editar from usuarios_modulos where user_id = auth.uid()
  union all
  select unnest(array['empleados','sucursales','puestos','horarios',
                       'asistencia','incidencias','vacaciones','actas','nomina','documentos',
                       'reportes','usuarios','capacitacion','onboarding','calculadoras',
                       'calendario','organigrama','auditoria','empresas','prestamos',
                       'nom035','notificaciones']) as modulo,
         true as puede_editar
    where current_user_es_admin();
