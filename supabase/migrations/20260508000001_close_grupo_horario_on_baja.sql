-- ============================================================
-- Cierra automáticamente la asignación de grupo_horario activa
-- cuando un empleado pasa a estatus 'baja'.
-- ============================================================

create or replace function fn_close_grupo_horario_on_baja()
returns trigger
language plpgsql
as $$
begin
  -- Solo actuar cuando el estatus cambió A 'baja'
  if NEW.estatus = 'baja' and (TG_OP = 'INSERT' or OLD.estatus is distinct from 'baja') then
    update empleado_grupo
    set vigente_hasta = coalesce(NEW.fecha_baja, current_date)
    where empleado_id = NEW.id
      and vigente_hasta is null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_close_grupo_horario_on_baja on empleados;
create trigger trg_close_grupo_horario_on_baja
after insert or update of estatus, fecha_baja on empleados
for each row execute function fn_close_grupo_horario_on_baja();

-- ------------------------------------------------------------
-- Limpieza one-shot: cierra grupos activos de empleados ya en baja.
-- ------------------------------------------------------------
update empleado_grupo eg
set vigente_hasta = coalesce(e.fecha_baja, current_date)
from empleados e
where e.id = eg.empleado_id
  and e.estatus = 'baja'
  and eg.vigente_hasta is null;
