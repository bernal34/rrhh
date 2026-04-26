-- ============================================================
-- SEED de prueba: 30 empleados + asistencia abril 2026 + préstamos + bonos
-- ============================================================
-- Pegar en Supabase SQL Editor y RUN.
-- Todos los registros llevan prefijo DEMO- para limpieza fácil.
-- Para borrar todo lo de demo:
--   delete from empleados where codigo like 'DEMO-%';
--   (cascada borra sueldos, asistencia, prestamos, etc.)
-- ============================================================

do $$
declare
  v_sucursal_id uuid;
  v_empresa_id  uuid;
  v_puesto_caj  uuid;
  v_puesto_mes  uuid;
  v_puesto_ger  uuid;
  v_turno_id    uuid;
  v_grupo_id    uuid;
  v_emp_id      uuid;
  v_concepto_bono_punt uuid;
  v_concepto_bono_asis uuid;
  i int;
  v_nombre text;
  v_appat text;
  v_apmat text;
  v_sueldo_diario numeric;
  v_codigo text;
  v_fecha_ingreso date;
  v_dia date;
  v_hora_entrada time;
  v_minutos_retardo int;
  v_falta boolean;
  nombres_h text[] := array[
    'Juan','Carlos','Luis','Miguel','Jose','Pedro','Diego','Alberto','Roberto','Fernando',
    'Andres','Daniel','Ricardo','Eduardo','Sergio','Hector','Pablo','Manuel','Raul','Oscar'
  ];
  nombres_m text[] := array[
    'Maria','Ana','Laura','Gabriela','Patricia','Lucia','Elena','Sofia','Carmen','Rosa',
    'Veronica','Isabel','Andrea','Monica','Adriana','Claudia','Beatriz','Silvia','Sandra','Diana'
  ];
  apellidos text[] := array[
    'Garcia','Hernandez','Martinez','Lopez','Gonzalez','Rodriguez','Perez','Sanchez',
    'Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Cruz','Morales','Ortiz',
    'Gutierrez','Chavez','Vargas','Castillo','Romero','Mendoza','Herrera','Aguilar','Medina','Castro'
  ];
begin
  -- 1) Toma la primera sucursal/empresa/puestos disponibles
  select id into v_sucursal_id from sucursales where activo = true order by created_at limit 1;
  select id into v_empresa_id  from empresas where activo = true order by created_at limit 1;
  select id into v_puesto_caj  from puestos where lower(nombre) like '%cajer%' and activo = true limit 1;
  select id into v_puesto_mes  from puestos where lower(nombre) like '%meser%' and activo = true limit 1;
  select id into v_puesto_ger  from puestos where lower(nombre) like '%gerent%' and activo = true limit 1;

  -- Si faltan puestos básicos, los crea
  if v_puesto_caj is null then
    insert into puestos(nombre, sueldo_base_sugerido) values('Cajero', 400) returning id into v_puesto_caj;
  end if;
  if v_puesto_mes is null then
    insert into puestos(nombre, sueldo_base_sugerido) values('Mesero', 350) returning id into v_puesto_mes;
  end if;
  if v_puesto_ger is null then
    insert into puestos(nombre, sueldo_base_sugerido) values('Gerente', 1200) returning id into v_puesto_ger;
  end if;

  if v_sucursal_id is null then
    insert into sucursales(nombre, direccion) values('Matriz Demo', 'Av. Demo 100')
      returning id into v_sucursal_id;
  end if;

  -- 2) Turno + Grupo demo (Lun-Vie 8-18, Sab 9-15, Dom descanso)
  select id into v_turno_id from turnos where nombre = 'DEMO Lun-Vie 8-18';
  if v_turno_id is null then
    insert into turnos(nombre, hora_entrada, hora_salida, tolerancia_retardo_min, tolerancia_falta_min, color)
    values('DEMO Lun-Vie 8-18', '08:00', '18:00', 10, 60, '#4f46e5')
    returning id into v_turno_id;
  end if;

  select id into v_grupo_id from grupos_horario where nombre = 'DEMO Estándar';
  if v_grupo_id is null then
    insert into grupos_horario(nombre, descripcion, sucursal_id)
    values('DEMO Estándar', 'Lun-Sab 8-18 (demo)', v_sucursal_id)
    returning id into v_grupo_id;
    -- Asigna turno a Lun-Vie (1-5), Sab (6) descanso a las 9, Dom (0) descanso
    insert into grupo_turno_dia(grupo_id, dia_semana, turno_id) values
      (v_grupo_id, 1, v_turno_id),
      (v_grupo_id, 2, v_turno_id),
      (v_grupo_id, 3, v_turno_id),
      (v_grupo_id, 4, v_turno_id),
      (v_grupo_id, 5, v_turno_id);
  end if;

  -- 3) Conceptos de bono y reglas (si no existen)
  select id into v_concepto_bono_punt from conceptos_nomina where clave = 'BONO_PUNT';
  if v_concepto_bono_punt is null then
    insert into conceptos_nomina(clave, nombre, tipo, calculo, valor, activo, orden)
    values('BONO_PUNT', 'Bono de puntualidad', 'percepcion', 'fijo', 500, true, 50)
    returning id into v_concepto_bono_punt;
  end if;

  select id into v_concepto_bono_asis from conceptos_nomina where clave = 'BONO_ASIS';
  if v_concepto_bono_asis is null then
    insert into conceptos_nomina(clave, nombre, tipo, calculo, valor, activo, orden)
    values('BONO_ASIS', 'Bono de asistencia', 'percepcion', 'fijo', 800, true, 51)
    returning id into v_concepto_bono_asis;
  end if;

  -- Conceptos básicos requeridos por la función (SUELDO, FALTAS, RETARDOS, HRS_EXTRA)
  insert into conceptos_nomina(clave, nombre, tipo, calculo, valor, activo, orden) values
    ('SUELDO', 'Sueldo del periodo', 'percepcion', 'automatico', 0, true, 10),
    ('HRS_EXTRA', 'Horas extra', 'percepcion', 'automatico', 0, true, 20),
    ('FALTAS', 'Descuento por faltas', 'deduccion', 'automatico', 0, true, 30),
    ('RETARDOS', 'Descuento por retardos', 'deduccion', 'automatico', 0, true, 40)
  on conflict (clave) do nothing;

  if not exists(select 1 from reglas_bono where nombre = 'DEMO Puntualidad') then
    insert into reglas_bono(nombre, concepto_id, tipo, monto, max_retardos_permitidos, activo)
    values('DEMO Puntualidad', v_concepto_bono_punt, 'puntualidad', 500, 1, true);
  end if;
  if not exists(select 1 from reglas_bono where nombre = 'DEMO Asistencia') then
    insert into reglas_bono(nombre, concepto_id, tipo, monto, max_faltas_permitidas, activo)
    values('DEMO Asistencia', v_concepto_bono_asis, 'asistencia', 800, 0, true);
  end if;

  -- 4) Generar 30 empleados con datos variados
  for i in 1..30 loop
    v_codigo := 'DEMO-' || lpad(i::text, 3, '0');
    -- Skip si ya existe
    if exists(select 1 from empleados where codigo = v_codigo) then
      continue;
    end if;

    if i % 2 = 0 then
      v_nombre := nombres_m[1 + (i % array_length(nombres_m, 1))];
    else
      v_nombre := nombres_h[1 + (i % array_length(nombres_h, 1))];
    end if;
    v_appat := apellidos[1 + (i % array_length(apellidos, 1))];
    v_apmat := apellidos[1 + ((i * 3) % array_length(apellidos, 1))];

    -- Fecha ingreso entre hace 6 meses y hace 8 años (variada)
    v_fecha_ingreso := current_date - ((30 + (i * 90)) || ' days')::interval;
    -- Sueldo diario: gerentes ~$1200, meseros $350, cajeros $450
    v_sueldo_diario := case
      when i % 10 = 0 then 1200  -- 3 gerentes
      when i % 3 = 0 then 350    -- 10 meseros
      else 450                    -- 17 cajeros
    end;

    insert into empleados(
      codigo, nombre, apellido_paterno, apellido_materno,
      rfc, curp, nss, fecha_nacimiento, genero,
      telefono, email,
      sucursal_id, puesto_id, empresa_id,
      fecha_ingreso, estatus
    ) values(
      v_codigo, v_nombre, v_appat, v_apmat,
      upper(substring(v_appat, 1, 4) || to_char(current_date - ((20 + i) * 365 || ' days')::interval, 'YYMMDD') || 'XX' || lpad(i::text, 1, '0')),
      upper(substring(v_appat, 1, 4) || to_char(current_date - ((20 + i) * 365 || ' days')::interval, 'YYMMDD') || 'HDFRRR0' || lpad(i::text, 1, '0')),
      lpad((10000000000 + i * 1234567)::text, 11, '0'),
      (current_date - ((20 + i) * 365 || ' days')::interval)::date,
      case when i % 2 = 0 then 'F' else 'M' end,
      '55' || lpad((10000000 + i * 7919)::text, 8, '0'),
      lower(v_nombre || '.' || v_appat || '@demo.com'),
      v_sucursal_id,
      case when i % 10 = 0 then v_puesto_ger when i % 3 = 0 then v_puesto_mes else v_puesto_caj end,
      v_empresa_id,
      v_fecha_ingreso,
      'activo'
    ) returning id into v_emp_id;

    -- Sueldo
    insert into empleado_sueldo(empleado_id, sueldo_diario, tipo_pago, vigente_desde)
      values(v_emp_id, v_sueldo_diario, 'quincenal', v_fecha_ingreso);

    -- Asignar al grupo de horario demo
    insert into empleado_grupo(empleado_id, grupo_id, vigente_desde)
      values(v_emp_id, v_grupo_id, v_fecha_ingreso);
  end loop;

  -- 5) Generar checadas para cada empleado DEMO en abril 2026 (Lun-Vie)
  for v_emp_id in select id from empleados where codigo like 'DEMO-%' loop
    for v_dia in
      select g::date from generate_series('2026-04-01'::date, '2026-04-30'::date, interval '1 day') g
       where extract(dow from g) between 1 and 5
    loop
      -- 5% de las veces, falta (no inserta checada)
      if random() < 0.05 then
        continue;
      end if;
      -- 15% de las veces, retardo entre 11-45 min
      if random() < 0.15 then
        v_minutos_retardo := 11 + (random() * 34)::int;
      else
        -- Llega normal (entre 7:50 y 8:09)
        v_minutos_retardo := -10 + (random() * 18)::int;
      end if;
      v_hora_entrada := ('08:00'::time + (v_minutos_retardo || ' minutes')::interval)::time;

      -- Entrada
      insert into checadas(empleado_id, sucursal_id, fecha_hora, tipo, dispositivo)
      values(v_emp_id, v_sucursal_id,
             (v_dia + v_hora_entrada)::timestamptz, 'entrada', 'DEMO-Seed');
      -- Salida ~18:00 con variancia
      insert into checadas(empleado_id, sucursal_id, fecha_hora, tipo, dispositivo)
      values(v_emp_id, v_sucursal_id,
             (v_dia + ('18:00'::time + ((random() * 30 - 5)::int || ' minutes')::interval))::timestamptz,
             'salida', 'DEMO-Seed');
    end loop;
  end loop;

  -- 6) Préstamos: 6 empleados con préstamos activos
  for v_emp_id in
    select id from empleados where codigo like 'DEMO-%' order by codigo limit 6
  loop
    insert into prestamos(empleado_id, monto_total, num_pagos, monto_por_pago,
                          fecha_inicio, motivo, estatus)
    values(v_emp_id,
           5000 + (random() * 15000)::int,
           6 + (random() * 12)::int,
           500,
           '2026-03-01',
           'Préstamo personal demo',
           'activo');
  end loop;

  -- 7) Recalcular asistencia abril
  perform fn_compute_asistencia_rango('2026-04-01'::date, '2026-04-30'::date, null);

  raise notice 'Seed completado: 30 empleados DEMO con asistencia, préstamos y bonos para abril 2026';
end $$;
