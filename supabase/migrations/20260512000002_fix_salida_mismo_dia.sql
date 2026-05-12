-- ============================================================
-- Fix: salida_real debe ser la última checada del MISMO día,
-- estrictamente posterior a la entrada.
-- ============================================================
-- Problema previo:
--   1) La ventana de salida era de 48 h (`< v_dia_fin + '1 day'`).
--      Esto provocaba que la primera checada del DÍA SIGUIENTE
--      (entrada del día siguiente) fuera tomada como salida del
--      día actual.
--   2) Si solo había una checada en el día, `max() = min() = misma`,
--      por lo que `salida_real` quedaba igual a `entrada_real`
--      en lugar de quedar como NULL (no hay salida real).
--
-- Solución:
--   - Buscar la salida dentro del MISMO día local (no 48 h).
--   - Exigir `fecha_hora > v_entrada` (estricto) — si no existe una
--     checada posterior a la entrada el mismo día, salida_real es NULL.
-- ============================================================

create or replace function fn_compute_asistencia_rango(
  p_desde date,
  p_hasta date,
  p_empleado_id uuid default null
) returns int
language plpgsql
as $$
declare
  v_local_tz constant text := 'America/Hermosillo';
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
  v_dia_inicio timestamptz;
  v_dia_fin timestamptz;
begin
  for r_emp in
    select id from empleados
    where estatus in ('activo','permiso','vacaciones')
      and (p_empleado_id is null or id = p_empleado_id)
  loop
    for r_fecha in select g::date from generate_series(p_desde, p_hasta, interval '1 day') g
    loop
      select tipo, afecta_sueldo, afecta_asistencia
        into v_incidencia
        from incidencias
        where empleado_id = r_emp.id
          and estatus in ('aprobada','aplicada')
          and r_fecha between fecha_inicio and fecha_fin
        order by created_at desc
        limit 1;

      v_incidencia_tipo := v_incidencia.tipo;

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
          where asistencia_dia.bloqueado = false
            and asistencia_dia.editado_manual = false;
        v_count := v_count + 1;
        continue;
      end if;

      select hora_entrada, hora_salida, tolerancia_retardo_min, tolerancia_falta_min
        into v_turno from turnos where id = v_turno_id;

      v_dia_inicio := (r_fecha::timestamp) at time zone v_local_tz;
      v_dia_fin    := ((r_fecha + interval '1 day')::timestamp) at time zone v_local_tz;

      -- Entrada: primera checada del día local
      select min(fecha_hora) into v_entrada
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= v_dia_inicio
          and fecha_hora <  v_dia_fin;

      -- Salida: ÚLTIMA checada del mismo día local, estrictamente posterior
      -- a la entrada. Si no hay otra checada después de la entrada, queda NULL.
      v_salida := null;
      if v_entrada is not null then
        select max(fecha_hora) into v_salida
          from checadas
          where empleado_id = r_emp.id
            and fecha_hora >  v_entrada
            and fecha_hora <  v_dia_fin;
      end if;

      if v_entrada is null then
        v_retardo := null;
        v_falta := true;
        v_trabajados := null;
      else
        v_retardo := greatest(
          0,
          (extract(epoch from (v_entrada at time zone v_local_tz)::time - v_turno.hora_entrada) / 60)::int
        );
        v_falta := v_retardo > v_turno.tolerancia_falta_min;
        if v_salida is not null then
          v_trabajados := (extract(epoch from (v_salida - v_entrada)) / 60)::int;
        else
          v_trabajados := null;
        end if;
      end if;

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
        where asistencia_dia.bloqueado = false
          and asistencia_dia.editado_manual = false;

      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
