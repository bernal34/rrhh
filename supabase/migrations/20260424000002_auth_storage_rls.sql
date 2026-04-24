-- ============================================================
-- Buckets de Storage y políticas RLS básicas
-- ============================================================

-- ------------------------------------------------------------
-- Buckets
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('empleados-fotos', 'empleados-fotos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('empleados-docs', 'empleados-docs', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Policies sobre storage.objects
-- ------------------------------------------------------------
drop policy if exists "fotos public read" on storage.objects;
create policy "fotos public read" on storage.objects
  for select using (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth write" on storage.objects;
create policy "fotos auth write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth update" on storage.objects;
create policy "fotos auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'empleados-fotos');

drop policy if exists "fotos auth delete" on storage.objects;
create policy "fotos auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'empleados-fotos');

drop policy if exists "docs auth all" on storage.objects;
create policy "docs auth all" on storage.objects
  for all to authenticated
  using (bucket_id = 'empleados-docs')
  with check (bucket_id = 'empleados-docs');

-- ------------------------------------------------------------
-- Helper: rol del usuario actual
-- ------------------------------------------------------------
create or replace function current_user_rol() returns rol_rrhh
  language sql stable security definer
as $$
  select rol from usuarios_rol where user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- RLS en tablas del dominio (MVP: cualquier usuario autenticado)
-- Endurecer por rol más adelante usando current_user_rol()
-- ------------------------------------------------------------
alter table sucursales                  enable row level security;
alter table puestos                     enable row level security;
alter table empleados                   enable row level security;
alter table empleado_sueldo             enable row level security;
alter table conceptos_nomina            enable row level security;
alter table empleado_conceptos          enable row level security;
alter table periodos_nomina             enable row level security;
alter table nomina_detalle              enable row level security;
alter table nomina_conceptos_aplicados  enable row level security;
alter table documentos                  enable row level security;
alter table notas                       enable row level security;
alter table checadas                    enable row level security;
alter table integracion_hikvision       enable row level security;
alter table empleado_hikvision_map      enable row level security;
alter table sucursal_hikvision_map      enable row level security;
alter table usuarios_rol                enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'sucursales','puestos','empleados','empleado_sueldo','conceptos_nomina',
    'empleado_conceptos','periodos_nomina','nomina_detalle','nomina_conceptos_aplicados',
    'documentos','notas','checadas','empleado_hikvision_map','sucursal_hikvision_map'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists "auth all" on %I;
       create policy "auth all" on %I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- Tabla de integración: solo admin_rh
drop policy if exists "integracion admin" on integracion_hikvision;
create policy "integracion admin" on integracion_hikvision
  for all to authenticated
  using (current_user_rol() = 'admin_rh')
  with check (current_user_rol() = 'admin_rh');

-- usuarios_rol: cada quien ve su propio registro; admin_rh ve todos
drop policy if exists "usuarios_rol self" on usuarios_rol;
create policy "usuarios_rol self" on usuarios_rol
  for select to authenticated
  using (user_id = auth.uid() or current_user_rol() = 'admin_rh');

drop policy if exists "usuarios_rol admin write" on usuarios_rol;
create policy "usuarios_rol admin write" on usuarios_rol
  for all to authenticated
  using (current_user_rol() = 'admin_rh')
  with check (current_user_rol() = 'admin_rh');
