-- ============================================================
-- Fix: fn_compute_asistencia_rango respeta zona horaria local
-- ============================================================
-- Problema: las checadas se guardan en timestamptz (UTC). La función
-- comparaba la hora de entrada contra el turno extrayendo el time en UTC,
-- y delimitaba el rango del día también con casts UTC. Eso provoca que:
--   1) Checadas cercanas a medianoche queden fuera del día correcto.
--   2) Toda comparación de retardo/falta esté desviada por el offset UTC.
--      (ej: entrada 07:18 local en Sonora → 14:18 UTC → "retardo 7h" → falta).
--
-- Si tu zona local es distinta a Sonora, cambia el valor de v_local_tz
-- (lista válida: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
-- Algunos comunes en MX:
--   America/Hermosillo  (Sonora, sin DST, UTC-7)
--   America/Mazatlan    (Sinaloa/Nayarit/BCS, con DST)
--   America/Mexico_City (centro, con DST)
--   America/Tijuana     (BC, con DST)
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

      -- Rango del día en zona local convertido a timestamptz para filtrar checadas
      v_dia_inicio := (r_fecha::timestamp) at time zone v_local_tz;
      v_dia_fin    := ((r_fecha + interval '1 day')::timestamp) at time zone v_local_tz;

      select min(fecha_hora) into v_entrada
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= v_dia_inicio
          and fecha_hora <  v_dia_fin;

      select max(fecha_hora) into v_salida
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= v_dia_inicio
          and fecha_hora <  v_dia_fin + interval '1 day'; -- ventana 48h por turnos nocturnos

      if v_entrada is null then
        v_retardo := null;
        v_falta := true;
        v_trabajados := null;
      else
        -- Compara la hora de entrada en zona local contra el turno (también local)
        v_retardo := greatest(
          0,
          (extract(epoch from (v_entrada at time zone v_local_tz)::time - v_turno.hora_entrada) / 60)::int
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
