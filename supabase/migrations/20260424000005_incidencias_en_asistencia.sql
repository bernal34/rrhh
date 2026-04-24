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
