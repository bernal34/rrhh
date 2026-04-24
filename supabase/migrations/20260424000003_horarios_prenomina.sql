-- ============================================================
-- Horarios, asistencia computada, bonos y prenómina con autorizaciones
-- ============================================================

-- ------------------------------------------------------------
-- Turnos (plantilla de horario)
-- ------------------------------------------------------------
create table turnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  hora_entrada time not null,
  hora_salida time not null,
  cruza_medianoche boolean generated always as (hora_salida <= hora_entrada) stored,
  tolerancia_retardo_min int not null default 10,
  tolerancia_falta_min int not null default 60,
  color text default '#6366f1',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Grupos de horario (p.ej. 'Matutino Sucursal A', 'Cocina Noche')
-- ------------------------------------------------------------
create table grupos_horario (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  sucursal_id uuid references sucursales(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qué turno aplica a cada día de la semana (0=dom..6=sab). turno_id null = descanso.
create table grupo_turno_dia (
  grupo_id uuid not null references grupos_horario(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  turno_id uuid references turnos(id),
  primary key (grupo_id, dia_semana)
);

-- ------------------------------------------------------------
-- Asignación empleado -> grupo (con vigencias)
-- ------------------------------------------------------------
create table empleado_grupo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  grupo_id uuid not null references grupos_horario(id),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now()
);
create index idx_emp_grupo on empleado_grupo(empleado_id, vigente_desde desc);

-- Override de turno puntual (día específico, ej. cubre turno ajeno)
create table empleado_turno_override (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_id uuid references turnos(id),  -- null = descanso forzado
  nota text,
  unique (empleado_id, fecha)
);

-- ------------------------------------------------------------
-- Asistencia consolidada por día (resultado de checadas vs turno esperado)
-- ------------------------------------------------------------
create table asistencia_dia (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_id uuid references turnos(id),
  hora_entrada_esperada time,
  hora_salida_esperada time,
  entrada_real timestamptz,
  salida_real timestamptz,
  minutos_retardo int default 0,
  minutos_trabajados int,
  horas_extra numeric(5, 2) default 0,
  falta boolean not null default false,
  incidencia text,                                   -- permiso, vacaciones, incapacidad
  bloqueado boolean not null default false,          -- true cuando ya está en prenómina autorizada
  recalculado_at timestamptz not null default now(),
  unique (empleado_id, fecha)
);
create index idx_asistencia_fecha on asistencia_dia(fecha desc);
create index idx_asistencia_empleado on asistencia_dia(empleado_id, fecha desc);

-- ------------------------------------------------------------
-- Reglas de bonos (ligan un concepto_nomina con una regla de cálculo)
-- ------------------------------------------------------------
create type tipo_regla_bono as enum ('puntualidad', 'asistencia', 'fijo');

create table reglas_bono (
  id uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references conceptos_nomina(id),
  nombre text not null,
  tipo tipo_regla_bono not null,
  monto numeric(12, 2) not null default 0,
  max_retardos_permitidos int default 0,
  max_faltas_permitidas int default 0,
  aplica_sucursal_id uuid references sucursales(id),   -- null = todas
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Prenómina (cabecera con flujo de autorización)
-- ------------------------------------------------------------
create type estatus_prenomina as enum (
  'borrador', 'en_revision', 'autorizada', 'cancelada', 'convertida'
);

create table prenomina (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references periodos_nomina(id),
  sucursal_id uuid references sucursales(id),
  estatus estatus_prenomina not null default 'borrador',
  total_percepciones numeric(14, 2) default 0,
  total_deducciones numeric(14, 2) default 0,
  total_neto numeric(14, 2) default 0,
  num_empleados int default 0,
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid,
  enviada_revision_at timestamptz,
  enviada_revision_by uuid,
  autorizada_at timestamptz,
  autorizada_by uuid,
  cancelada_at timestamptz,
  cancelada_by uuid,
  motivo_cancelacion text
);

-- Enlace nomina_detalle -> prenomina + estado propio
alter table nomina_detalle add column prenomina_id uuid references prenomina(id) on delete set null;

-- ------------------------------------------------------------
-- Función: fn_compute_asistencia_rango
-- Recalcula asistencia_dia para un rango de fechas. Respeta `bloqueado`.
-- ------------------------------------------------------------
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
  v_count int := 0;
begin
  for r_emp in
    select id from empleados
    where estatus in ('activo','permiso','vacaciones')
      and (p_empleado_id is null or id = p_empleado_id)
  loop
    for r_fecha in select g::date from generate_series(p_desde, p_hasta, interval '1 day') g
    loop
      -- override puntual tiene prioridad
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
        -- descanso: registra fila sin turno, falta = false
        insert into asistencia_dia (empleado_id, fecha, turno_id, falta)
        values (r_emp.id, r_fecha, null, false)
        on conflict (empleado_id, fecha) do update
          set turno_id = null,
              hora_entrada_esperada = null,
              hora_salida_esperada = null,
              falta = false,
              recalculado_at = now()
          where asistencia_dia.bloqueado = false;
        v_count := v_count + 1;
        continue;
      end if;

      select hora_entrada, hora_salida, tolerancia_retardo_min, tolerancia_falta_min
        into v_turno from turnos where id = v_turno_id;

      -- Checadas del día (ventana de 24h + margen para turnos nocturnos)
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

      insert into asistencia_dia (
        empleado_id, fecha, turno_id,
        hora_entrada_esperada, hora_salida_esperada,
        entrada_real, salida_real,
        minutos_retardo, minutos_trabajados, falta
      ) values (
        r_emp.id, r_fecha, v_turno_id,
        v_turno.hora_entrada, v_turno.hora_salida,
        v_entrada, v_salida,
        coalesce(v_retardo, 0), v_trabajados, v_falta
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
          recalculado_at = now()
        where asistencia_dia.bloqueado = false;

      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Función: fn_generar_prenomina
-- Genera prenómina para un periodo. Calcula sueldo, retardos, faltas, bonos,
-- conceptos recurrentes y guarda desglose en nomina_detalle.
-- ------------------------------------------------------------
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
  v_faltas int;
  v_retardos int;
  v_minutos_retardo int;
  v_sueldo_diario numeric;
  v_sueldo_base numeric;
  v_descuento_falta numeric;
  v_descuento_retardo numeric;
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

  -- Asegura asistencia calculada en el rango
  perform fn_compute_asistencia_rango(v_periodo.fecha_inicio, v_periodo.fecha_fin, null);

  -- Cabecera prenómina
  insert into prenomina (periodo_id, sucursal_id, estatus, created_by)
  values (p_periodo_id, p_sucursal_id, 'borrador', auth.uid())
  returning id into v_pre_id;

  for r_emp in
    select e.id, e.sucursal_id,
           concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) as nombre_full
      from empleados e
      where e.estatus = 'activo'
        and (p_sucursal_id is null or e.sucursal_id = p_sucursal_id)
  loop
    -- Sueldo vigente al inicio del periodo
    select sueldo_diario into v_sueldo_diario
      from empleado_sueldo
      where empleado_id = r_emp.id
        and vigente_desde <= v_periodo.fecha_inicio
        and (vigente_hasta is null or vigente_hasta >= v_periodo.fecha_inicio)
      order by vigente_desde desc
      limit 1;

    if v_sueldo_diario is null then
      v_sueldo_diario := 0;
    end if;

    -- Métricas desde asistencia_dia
    select
      coalesce(sum(case when turno_id is not null and not falta then 1 else 0 end), 0),
      coalesce(sum(case when falta then 1 else 0 end), 0),
      coalesce(sum(case when minutos_retardo > 0 then 1 else 0 end), 0),
      coalesce(sum(minutos_retardo), 0)
    into v_dias_trabajados, v_faltas, v_retardos, v_minutos_retardo
    from asistencia_dia
    where empleado_id = r_emp.id
      and fecha between v_periodo.fecha_inicio and v_periodo.fecha_fin;

    v_sueldo_base := round(v_sueldo_diario * v_dias_trabajados, 2);
    v_descuento_falta := round(v_sueldo_diario * v_faltas, 2);
    -- Descuento por minutos de retardo (proporcional a jornada 8h)
    v_descuento_retardo := round((v_sueldo_diario / 8.0 / 60.0) * v_minutos_retardo, 2);

    v_total_p := v_sueldo_base;
    v_total_d := v_descuento_falta + v_descuento_retardo;

    v_desglose := jsonb_build_object(
      'dias_periodo', v_dias_periodo,
      'dias_trabajados', v_dias_trabajados,
      'faltas', v_faltas,
      'retardos', v_retardos,
      'minutos_retardo', v_minutos_retardo,
      'sueldo_diario', v_sueldo_diario,
      'sueldo_base', v_sueldo_base,
      'descuento_faltas', v_descuento_falta,
      'descuento_retardos', v_descuento_retardo,
      'conceptos', '[]'::jsonb
    );

    -- Detalle
    insert into nomina_detalle (
      periodo_id, prenomina_id, empleado_id,
      dias_trabajados, faltas, retardos,
      total_percepciones, total_deducciones, neto_pagar, desglose
    ) values (
      p_periodo_id, v_pre_id, r_emp.id,
      v_dias_trabajados, v_faltas, v_retardos,
      0, 0, 0, v_desglose
    ) returning id into v_detalle_id;

    -- Conceptos: sueldo base
    insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
    select v_detalle_id, id, v_sueldo_base, true
      from conceptos_nomina where clave = 'SUELDO';

    if v_descuento_falta > 0 then
      insert into nomina_conceptos_aplicados (nomina_detalle_id, concepto_id, monto, es_percepcion)
      select v_detalle_id, id, v_descuento_falta, false
        from conceptos_nomina where clave = 'FALTAS';
    end if;

    -- Bonos según reglas
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

    -- Conceptos recurrentes asignados al empleado (aditivas/deducciones fijas)
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

  return v_pre_id;
end;
$$;

-- ------------------------------------------------------------
-- Función: fn_autorizar_prenomina / fn_cancelar_prenomina
-- ------------------------------------------------------------
create or replace function fn_autorizar_prenomina(p_pre_id uuid) returns void
language plpgsql
as $$
declare v_pre record;
begin
  select * into v_pre from prenomina where id = p_pre_id;
  if v_pre is null then raise exception 'Prenómina no existe'; end if;
  if v_pre.estatus not in ('en_revision','borrador') then
    raise exception 'Estatus % no autorizable', v_pre.estatus;
  end if;

  update prenomina
    set estatus = 'autorizada',
        autorizada_at = now(),
        autorizada_by = auth.uid()
    where id = p_pre_id;

  -- Bloquea asistencia del periodo para evitar recálculos accidentales
  update asistencia_dia ad
    set bloqueado = true
    from nomina_detalle nd
    join periodos_nomina pn on pn.id = nd.periodo_id
    where nd.prenomina_id = p_pre_id
      and ad.empleado_id = nd.empleado_id
      and ad.fecha between pn.fecha_inicio and pn.fecha_fin;
end;
$$;

create or replace function fn_cancelar_prenomina(p_pre_id uuid, p_motivo text) returns void
language plpgsql
as $$
begin
  update prenomina
    set estatus = 'cancelada',
        cancelada_at = now(),
        cancelada_by = auth.uid(),
        motivo_cancelacion = p_motivo
    where id = p_pre_id
      and estatus in ('borrador','en_revision');
  if not found then raise exception 'No se pudo cancelar (estatus inválido)'; end if;
end;
$$;

-- ------------------------------------------------------------
-- RLS: autenticados (endurecer por rol admin_rh después)
-- ------------------------------------------------------------
alter table turnos                    enable row level security;
alter table grupos_horario            enable row level security;
alter table grupo_turno_dia           enable row level security;
alter table empleado_grupo            enable row level security;
alter table empleado_turno_override   enable row level security;
alter table asistencia_dia            enable row level security;
alter table reglas_bono               enable row level security;
alter table prenomina                 enable row level security;

do $$
declare
  t text;
  tables text[] := array['turnos','grupos_horario','grupo_turno_dia','empleado_grupo',
                         'empleado_turno_override','asistencia_dia','reglas_bono','prenomina'];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists "auth all" on %I;
       create policy "auth all" on %I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Vista: reporte asistencia diario (para reportes)
-- ------------------------------------------------------------
create or replace view v_reporte_asistencia as
select
  ad.fecha,
  e.id as empleado_id,
  concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) as empleado,
  e.codigo,
  s.nombre as sucursal,
  t.nombre as turno,
  ad.hora_entrada_esperada,
  ad.hora_salida_esperada,
  ad.entrada_real,
  ad.salida_real,
  ad.minutos_retardo,
  ad.minutos_trabajados,
  ad.falta,
  ad.incidencia,
  case
    when ad.turno_id is null then 'descanso'
    when ad.falta then 'falta'
    when ad.minutos_retardo > 0 then 'retardo'
    when ad.entrada_real is not null then 'puntual'
    else 'pendiente'
  end as estatus
from asistencia_dia ad
join empleados e on e.id = ad.empleado_id
left join sucursales s on s.id = e.sucursal_id
left join turnos t on t.id = ad.turno_id;
