-- ============================================================
-- Vacaciones según LFT 2023 (Reforma 1° enero 2023)
-- ============================================================
-- Tabla de días por antigüedad:
--   1 año: 12 · 2: 14 · 3: 16 · 4: 18 · 5: 20
--   6-10: 22 · 11-15: 24 · 16-20: 26 · 21-25: 28 · 26-30: 30 · 31+: 32
--
-- Las vacaciones tomadas viven en la tabla `incidencias` con tipo='vacaciones'
-- y estatus in ('aprobada','aplicada'). Aquí solo definimos saldo derivado.
-- ============================================================

create or replace function dias_vacaciones_lft(p_anios_antiguedad int) returns int
language sql immutable
as $$
  select case
    when p_anios_antiguedad < 1 then 0
    when p_anios_antiguedad = 1 then 12
    when p_anios_antiguedad = 2 then 14
    when p_anios_antiguedad = 3 then 16
    when p_anios_antiguedad = 4 then 18
    when p_anios_antiguedad = 5 then 20
    when p_anios_antiguedad <= 10 then 22
    when p_anios_antiguedad <= 15 then 24
    when p_anios_antiguedad <= 20 then 26
    when p_anios_antiguedad <= 25 then 28
    when p_anios_antiguedad <= 30 then 30
    else 32
  end;
$$;

-- Vista de saldos por empleado (calculada al vuelo)
create or replace view vacaciones_saldos as
with base as (
  select e.id as empleado_id,
         e.nombre,
         e.apellido_paterno,
         e.apellido_materno,
         e.codigo,
         e.fecha_ingreso,
         e.estatus,
         e.sucursal_id,
         floor(extract(epoch from age(current_date, e.fecha_ingreso)) / (365.25 * 86400))::int as anios_antiguedad
    from empleados e
   where e.estatus in ('activo','permiso','vacaciones')
)
select b.empleado_id,
       b.nombre, b.apellido_paterno, b.apellido_materno, b.codigo,
       b.sucursal_id, b.fecha_ingreso, b.anios_antiguedad,
       -- Suma acumulada de la tabla LFT por cada año cumplido
       coalesce(
         (select sum(dias_vacaciones_lft(n))
          from generate_series(1, greatest(b.anios_antiguedad, 0)) g(n)),
         0
       )::int as dias_ganados_total,
       -- Días ya tomados (incidencias vacaciones aprobadas o aplicadas)
       coalesce(
         (select sum(i.dias) from incidencias i
           where i.empleado_id = b.empleado_id
             and i.tipo = 'vacaciones'
             and i.estatus in ('aprobada','aplicada')),
         0
       )::numeric as dias_tomados,
       -- Días tomados solo del año en curso
       coalesce(
         (select sum(i.dias) from incidencias i
           where i.empleado_id = b.empleado_id
             and i.tipo = 'vacaciones'
             and i.estatus in ('aprobada','aplicada')
             and i.fecha_inicio >= date_trunc('year', current_date)),
         0
       )::numeric as dias_tomados_anio_actual,
       -- Días que le tocan en el próximo aniversario
       dias_vacaciones_lft(b.anios_antiguedad + 1) as dias_proximo_periodo,
       -- Fecha del próximo aniversario laboral
       (b.fecha_ingreso + ((b.anios_antiguedad + 1) || ' years')::interval)::date
         as fecha_proximo_aniversario
  from base b;

grant select on vacaciones_saldos to authenticated;

-- Vista de solicitudes de vacaciones (incidencias tipo vacaciones)
create or replace view vacaciones_solicitudes as
select i.id,
       i.empleado_id,
       e.nombre || ' ' || coalesce(e.apellido_paterno, '') as empleado_nombre,
       e.codigo as empleado_codigo,
       e.sucursal_id,
       i.fecha_inicio,
       i.fecha_fin,
       i.dias,
       i.descripcion,
       i.estatus,
       i.created_at,
       i.aprobada_at,
       i.aprobada_by,
       i.motivo_rechazo
  from incidencias i
  join empleados e on e.id = i.empleado_id
 where i.tipo = 'vacaciones';

grant select on vacaciones_solicitudes to authenticated;
