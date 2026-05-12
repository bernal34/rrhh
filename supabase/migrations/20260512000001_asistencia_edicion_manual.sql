-- ============================================================
-- Edición manual de asistencia con bitácora
-- ============================================================
-- Permite editar entrada_real / salida_real / falta / incidencia
-- de un día específico. El recálculo automático respeta los registros
-- editados manualmente (no los sobrescribe).
-- ============================================================

alter table asistencia_dia
  add column if not exists editado_manual boolean not null default false,
  add column if not exists editado_motivo text,
  add column if not exists editado_por    uuid references auth.users(id),
  add column if not exists editado_at     timestamptz;

create index if not exists idx_asistencia_editado_manual
  on asistencia_dia(editado_manual) where editado_manual = true;

-- ------------------------------------------------------------
-- fn_editar_asistencia_manual
-- Recalcula minutos_retardo y minutos_trabajados con la nueva
-- entrada/salida (zona horaria local), marca editado_manual,
-- y registra el cambio en bitacora_auditoria.
-- ------------------------------------------------------------
create or replace function fn_editar_asistencia_manual(
  p_id         uuid,
  p_entrada    timestamptz,
  p_salida     timestamptz,
  p_falta      boolean,
  p_incidencia text,
  p_motivo     text
) returns asistencia_dia
language plpgsql
as $$
declare
  v_local_tz constant text := 'America/Hermosillo';
  v_old      asistencia_dia;
  v_new      asistencia_dia;
  v_retardo  int := 0;
  v_trabajados int;
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo es obligatorio para la edición manual';
  end if;

  select * into v_old from asistencia_dia where id = p_id;
  if not found then
    raise exception 'Registro de asistencia no encontrado';
  end if;
  if v_old.bloqueado then
    raise exception 'Este día está bloqueado por una prenómina autorizada y no puede editarse';
  end if;

  if p_entrada is not null and v_old.hora_entrada_esperada is not null then
    v_retardo := greatest(
      0,
      (extract(epoch from (p_entrada at time zone v_local_tz)::time - v_old.hora_entrada_esperada) / 60)::int
    );
  end if;

  if p_entrada is not null and p_salida is not null and p_salida > p_entrada then
    v_trabajados := (extract(epoch from (p_salida - p_entrada)) / 60)::int;
  end if;

  update asistencia_dia
    set entrada_real        = p_entrada,
        salida_real         = p_salida,
        minutos_retardo     = v_retardo,
        minutos_trabajados  = v_trabajados,
        falta               = coalesce(p_falta, false),
        incidencia          = p_incidencia,
        editado_manual      = true,
        editado_motivo      = p_motivo,
        editado_por         = auth.uid(),
        editado_at          = now(),
        recalculado_at      = now()
    where id = p_id
    returning * into v_new;

  -- Bitácora
  insert into bitacora_auditoria (user_id, user_email, tabla, operacion, registro_id, cambios)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'asistencia_dia',
    'UPDATE',
    p_id::text,
    jsonb_build_object(
      'motivo',  p_motivo,
      'antes',   to_jsonb(v_old),
      'despues', to_jsonb(v_new)
    )
  );

  return v_new;
end $$;

-- ------------------------------------------------------------
-- fn_compute_asistencia_rango (replace)
-- Misma lógica del fix de timezone, pero ahora también respeta
-- registros marcados como editado_manual=true.
-- ------------------------------------------------------------
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

      select min(fecha_hora) into v_entrada
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= v_dia_inicio
          and fecha_hora <  v_dia_fin;

      select max(fecha_hora) into v_salida
        from checadas
        where empleado_id = r_emp.id
          and fecha_hora >= v_dia_inicio
          and fecha_hora <  v_dia_fin + interval '1 day';

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
        if v_salida is not null and v_salida > v_entrada then
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
