-- ============================================================
-- Fix: el loop de empleado_conceptos en fn_generar_prenomina
-- referenciaba ec.activo (no existe) y ec.monto (no existe).
-- Restauramos el JOIN con conceptos_nomina + coalesce(monto_override, cn.valor)
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
  v_existe_autorizada boolean;
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

  select exists (
    select 1 from prenomina
     where periodo_id = p_periodo_id
       and (p_sucursal_id is null or sucursal_id is not distinct from p_sucursal_id)
       and estatus in ('autorizada', 'convertida')
  ) into v_existe_autorizada;

  if v_existe_autorizada then
    raise exception 'Ya existe una prenómina autorizada o convertida para ese periodo/sucursal. Cancélala primero.';
  end if;

  delete from nomina_conceptos_aplicados
   where nomina_detalle_id in (
     select nd.id from nomina_detalle nd
      join prenomina p on p.id = nd.prenomina_id
     where nd.periodo_id = p_periodo_id
       and (p_sucursal_id is null or p.sucursal_id is not distinct from p_sucursal_id)
       and p.estatus in ('borrador', 'en_revision', 'cancelada')
   );

  delete from nomina_detalle
   where periodo_id = p_periodo_id
     and prenomina_id in (
       select id from prenomina
        where periodo_id = p_periodo_id
          and (p_sucursal_id is null or sucursal_id is not distinct from p_sucursal_id)
          and estatus in ('borrador', 'en_revision', 'cancelada')
     );

  update prenomina
     set estatus = 'cancelada'
   where periodo_id = p_periodo_id
     and (p_sucursal_id is null or sucursal_id is not distinct from p_sucursal_id)
     and estatus in ('borrador', 'en_revision');

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

    select
      coalesce(sum(case when turno_id is not null and not falta then 1 else 0 end), 0),
      coalesce(sum(case when falta then 1 else 0 end), 0),
      coalesce(sum(case when minutos_retardo > 0 then 1 else 0 end), 0),
      coalesce(sum(minutos_retardo), 0)
    into v_dias_trabajados, v_faltas, v_retardos, v_minutos_retardo
    from asistencia_dia
    where empleado_id = r_emp.id
      and fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    select coalesce(sum(1), 0) into v_dias_pagados
    from asistencia_dia ad
    join incidencias i on i.empleado_id = ad.empleado_id
      and ad.fecha between i.fecha_inicio and i.fecha_fin
      and i.estatus in ('aprobada','aplicada')
      and i.afecta_sueldo = false
    where ad.empleado_id = r_emp.id
      and ad.fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    select coalesce(sum(horas), 0) into v_horas_extra
    from incidencias
    where empleado_id = r_emp.id
      and tipo = 'hora_extra'
      and estatus in ('aprobada','aplicada')
      and fecha_inicio between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    v_sueldo_base := round(v_sueldo_diario * v_dias_trabajados, 2);
    v_descuento_falta := round(v_sueldo_diario * v_faltas, 2);
    v_descuento_retardo := round((v_sueldo_diario / 8.0 / 60.0) * v_minutos_retardo, 2);
    v_monto_extra := round((v_sueldo_diario / 8.0) * 2 * v_horas_extra, 2);

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
        from conceptos_nomina where clave = 'HRS_EXTRA';
    end if;

    if v_descuento_falta > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_descuento_falta, false
        from conceptos_nomina where clave = 'FALTAS';
    end if;

    if v_descuento_retardo > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_descuento_retardo, false
        from conceptos_nomina where clave = 'RETARDOS';
    end if;

    -- Reglas de bono activas
    for r_bono in
      select b.*, c.id as concepto_id_real
        from reglas_bono b
        join conceptos_nomina c on c.id = b.concepto_id
       where b.activo = true
         and (b.aplica_sucursal_id is null or b.aplica_sucursal_id = r_emp.sucursal_id)
    loop
      if (r_bono.tipo = 'puntualidad' and v_retardos <= coalesce(r_bono.max_retardos_permitidos, 0))
         or (r_bono.tipo = 'asistencia' and v_faltas <= coalesce(r_bono.max_faltas_permitidas, 0))
         or (r_bono.tipo = 'fijo')
      then
        insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
        values (v_detalle_id, r_bono.concepto_id_real, r_bono.monto, true);
        v_total_p := v_total_p + r_bono.monto;
      end if;
    end loop;

    -- Conceptos recurrentes del empleado (FIX: JOIN con conceptos_nomina, sin columna 'activo')
    for r_conc_emp in
      select ec.concepto_id, cn.tipo, coalesce(ec.monto_override, cn.valor) as monto
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
end $$;
