-- Recreate aguinaldo_proyectado para incluir empresa_id (al FINAL para no
-- romper create-or-replace; postgres no deja reordenar/insertar columnas
-- existentes en una vista con CREATE OR REPLACE).
create or replace view aguinaldo_proyectado as
with sueldo_actual as (
  select distinct on (empleado_id) empleado_id, sueldo_diario, sueldo_mensual, vigente_desde
    from empleado_sueldo
   order by empleado_id, vigente_desde desc
)
select e.id as empleado_id,
       e.nombre, e.apellido_paterno, e.apellido_materno, e.codigo, e.sucursal_id,
       e.fecha_ingreso,
       coalesce(s.sueldo_mensual, 0) as sueldo_mensual,
       coalesce(s.sueldo_diario, 0)  as salario_diario,
       least(
         (current_date - greatest(e.fecha_ingreso, date_trunc('year', current_date)::date))::int + 1,
         365
       ) as dias_trabajados_anio,
       round(
         (least((current_date - greatest(e.fecha_ingreso, date_trunc('year', current_date)::date))::int + 1, 365) * 15.0)
         / 365.0 * coalesce(s.sueldo_diario, 0),
         2
       ) as aguinaldo_proporcional,
       round(15.0 * coalesce(s.sueldo_diario, 0), 2) as aguinaldo_completo_15dias,
       e.empresa_id
  from empleados e
  left join sueldo_actual s on s.empleado_id = e.id
 where e.estatus in ('activo','permiso','vacaciones');
