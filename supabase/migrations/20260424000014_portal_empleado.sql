-- ============================================================
-- Portal del empleado: vinculación user <-> empleado + vistas self-service
-- ============================================================

-- Vincula un usuario de auth con un registro de empleado (1 a 1)
alter table empleados add column if not exists user_id uuid references auth.users(id);
create unique index if not exists uq_empleados_user on empleados(user_id) where user_id is not null;

-- Vista: mi propio perfil
create or replace view mi_perfil as
  select e.*, p.nombre as puesto_nombre, s.nombre as sucursal_nombre,
         emp.razon_social as empresa_nombre, emp.logo_url as empresa_logo
    from empleados e
    left join puestos p on p.id = e.puesto_id
    left join sucursales s on s.id = e.sucursal_id
    left join empresas emp on emp.id = e.empresa_id
   where e.user_id = auth.uid();

grant select on mi_perfil to authenticated;

-- Vista: mis checadas (últimos 60 días)
create or replace view mis_checadas as
  select c.id, c.fecha_hora, c.tipo, c.dispositivo, c.sucursal_id
    from checadas c
    join empleados e on e.id = c.empleado_id
   where e.user_id = auth.uid()
     and c.fecha_hora >= current_date - interval '60 days'
   order by c.fecha_hora desc;

grant select on mis_checadas to authenticated;

-- Vista: mi asistencia (últimos 60 días)
-- estatus se deriva igual que en v_reporte_asistencia
create or replace view mi_asistencia as
  select a.fecha, a.entrada_real, a.salida_real, a.minutos_retardo, a.incidencia,
         case
           when a.turno_id is null then 'descanso'
           when a.falta then 'falta'
           when a.minutos_retardo > 0 then 'retardo'
           when a.entrada_real is not null then 'puntual'
           else 'pendiente'
         end as estatus
    from asistencia_dia a
    join empleados e on e.id = a.empleado_id
   where e.user_id = auth.uid()
     and a.fecha >= current_date - interval '60 days'
   order by a.fecha desc;

grant select on mi_asistencia to authenticated;

-- Vista: mi saldo de vacaciones
create or replace view mi_vacaciones_saldo as
  select v.*
    from vacaciones_saldos v
    join empleados e on e.id = v.empleado_id
   where e.user_id = auth.uid();

grant select on mi_vacaciones_saldo to authenticated;

-- Vista: mis incidencias / solicitudes
create or replace view mis_incidencias as
  select i.id, i.tipo, i.fecha_inicio, i.fecha_fin, i.dias, i.descripcion,
         i.estatus, i.created_at, i.aprobada_at, i.motivo_rechazo
    from incidencias i
    join empleados e on e.id = i.empleado_id
   where e.user_id = auth.uid()
   order by i.fecha_inicio desc;

grant select on mis_incidencias to authenticated;

-- Vista: mis recibos de nómina
create or replace view mis_recibos as
  select n.id, n.dias_trabajados, n.faltas, n.retardos,
         n.total_percepciones, n.total_deducciones, n.neto_pagar,
         p.tipo as periodo_tipo, p.fecha_inicio, p.fecha_fin, p.fecha_pago
    from nomina_detalle n
    join empleados e on e.id = n.empleado_id
    join periodos_nomina p on p.id = n.periodo_id
   where e.user_id = auth.uid()
   order by p.fecha_inicio desc;

grant select on mis_recibos to authenticated;

-- Vista: mis documentos
create or replace view mis_documentos as
  select d.id, d.tipo, d.nombre, d.fecha_emision, d.fecha_vencimiento, d.storage_path
    from documentos d
    join empleados e on e.id = d.empleado_id
   where e.user_id = auth.uid()
   order by d.fecha_emision desc nulls last;

grant select on mis_documentos to authenticated;

-- Función para que un empleado solicite incidencia (vacaciones, permiso, etc.)
create or replace function mi_solicitar_incidencia(
  p_tipo text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_descripcion text default null
) returns uuid
language plpgsql security definer
as $$
declare
  v_empleado_id uuid;
  v_id uuid;
begin
  select id into v_empleado_id from empleados where user_id = auth.uid();
  if v_empleado_id is null then
    raise exception 'Tu usuario no está vinculado a un empleado';
  end if;
  insert into incidencias(empleado_id, tipo, fecha_inicio, fecha_fin, descripcion,
                          afecta_sueldo, afecta_asistencia, estatus, created_by)
    values(v_empleado_id, p_tipo::tipo_incidencia, p_fecha_inicio, p_fecha_fin, p_descripcion,
           false, false, 'registrada', auth.uid())
    returning id into v_id;
  return v_id;
end $$;

grant execute on function mi_solicitar_incidencia(text, date, date, text) to authenticated;

-- Actualizar mis_modulos para incluir 'mi_portal' (todos los autenticados)
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
