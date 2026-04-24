-- ============================================================
-- Permisos por módulo (visibilidad + edición)
-- ============================================================
-- Modelo:
--   - admin_rh siempre tiene acceso total a todos los módulos.
--   - Resto de usuarios: una fila en usuarios_modulos por cada módulo
--     al que tienen acceso. puede_editar=false → solo lectura.
--   - Sin fila para un (user_id, modulo) → sin acceso a ese módulo.
-- ============================================================

create table if not exists usuarios_modulos (
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  puede_editar boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, modulo)
);

create index if not exists idx_usuarios_modulos_user on usuarios_modulos(user_id);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function current_user_es_admin() returns boolean
  language sql stable security definer
as $$
  select coalesce(
    (select rol = 'admin_rh' from usuarios_rol where user_id = auth.uid()),
    false
  );
$$;

create or replace function current_user_puede_ver(p_modulo text) returns boolean
  language sql stable security definer
as $$
  select current_user_es_admin()
      or exists(select 1 from usuarios_modulos
                where user_id = auth.uid() and modulo = p_modulo);
$$;

create or replace function current_user_puede_editar(p_modulo text) returns boolean
  language sql stable security definer
as $$
  select current_user_es_admin()
      or exists(select 1 from usuarios_modulos
                where user_id = auth.uid()
                  and modulo = p_modulo
                  and puede_editar = true);
$$;

-- ------------------------------------------------------------
-- Vista: módulos del usuario actual (la consume el frontend)
-- ------------------------------------------------------------
create or replace view mis_modulos as
  select modulo, puede_editar
    from usuarios_modulos
    where user_id = auth.uid()
  union all
  select unnest(array['empleados','sucursales','puestos','horarios',
                       'asistencia','incidencias','actas','nomina','documentos',
                       'reportes','usuarios']) as modulo,
         true as puede_editar
    where current_user_es_admin();

grant select on mis_modulos to authenticated;

-- ------------------------------------------------------------
-- Vista: usuarios para el panel de admin
-- ------------------------------------------------------------
create or replace view usuarios_admin as
  select u.id,
         u.email,
         u.created_at,
         u.last_sign_in_at,
         r.rol,
         coalesce(
           (select jsonb_agg(jsonb_build_object('modulo', m.modulo, 'puede_editar', m.puede_editar)
                             order by m.modulo)
            from usuarios_modulos m where m.user_id = u.id),
           '[]'::jsonb
         ) as modulos
    from auth.users u
    left join usuarios_rol r on r.user_id = u.id;

grant select on usuarios_admin to authenticated;

-- RLS no aplica a vistas; protegemos con security_invoker = false (default)
-- y un wrapper que filtra por rol admin
create or replace function list_usuarios_admin()
returns setof usuarios_admin
language sql stable security definer
as $$
  select * from usuarios_admin
  where current_user_es_admin();
$$;

grant execute on function list_usuarios_admin() to authenticated;

-- ------------------------------------------------------------
-- RLS sobre usuarios_modulos
-- ------------------------------------------------------------
alter table usuarios_modulos enable row level security;

drop policy if exists "modulos self read" on usuarios_modulos;
create policy "modulos self read" on usuarios_modulos
  for select to authenticated
  using (user_id = auth.uid() or current_user_es_admin());

drop policy if exists "modulos admin write" on usuarios_modulos;
create policy "modulos admin write" on usuarios_modulos
  for all to authenticated
  using (current_user_es_admin())
  with check (current_user_es_admin());

-- ------------------------------------------------------------
-- Reescribir RLS de tablas del dominio para usar permisos por módulo
-- ------------------------------------------------------------
do $$
declare
  par record;
  tabla_existe boolean;
begin
  for par in
    select * from (values
      ('sucursales',                'sucursales'),
      ('puestos',                   'puestos'),
      ('empleados',                 'empleados'),
      ('empleado_sueldo',           'empleados'),
      ('empleado_conceptos',        'empleados'),
      ('empleado_hikvision_map',    'empleados'),
      ('notas',                     'empleados'),
      ('turnos',                    'horarios'),
      ('grupos_horario',            'horarios'),
      ('grupo_turno_dia',           'horarios'),
      ('empleado_grupo',            'horarios'),
      ('empleado_turno_override',   'horarios'),
      ('checadas',                  'asistencia'),
      ('asistencia_dia',            'asistencia'),
      ('incidencias',               'incidencias'),
      ('actas_administrativas',     'actas'),
      ('conceptos_nomina',          'nomina'),
      ('reglas_bono',               'nomina'),
      ('periodos_nomina',           'nomina'),
      ('prenomina',                 'nomina'),
      ('nomina_detalle',            'nomina'),
      ('nomina_conceptos_aplicados','nomina'),
      ('documentos',                'documentos'),
      ('sucursal_hikvision_map',    'sucursales')
    ) as t(tabla, modulo)
  loop
    select exists(select 1 from information_schema.tables
                  where table_schema='public' and table_name=par.tabla)
      into tabla_existe;
    if not tabla_existe then continue; end if;

    execute format('alter table %I enable row level security', par.tabla);
    execute format('drop policy if exists "auth all" on %I', par.tabla);
    execute format('drop policy if exists "modulo read" on %I', par.tabla);
    execute format('drop policy if exists "modulo write" on %I', par.tabla);
    execute format(
      'create policy "modulo read" on %I for select to authenticated using (current_user_puede_ver(%L))',
      par.tabla, par.modulo);
    execute format(
      'create policy "modulo write" on %I for all to authenticated using (current_user_puede_editar(%L)) with check (current_user_puede_editar(%L))',
      par.tabla, par.modulo, par.modulo);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Bootstrap: asegurar que admin_rh actuales tengan rol cargado
-- ------------------------------------------------------------
-- (no inserta nada; solo deja la tabla lista)
