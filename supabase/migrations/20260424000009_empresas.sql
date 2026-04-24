-- ============================================================
-- Catálogo de Empresas + asignación al empleado
-- ============================================================
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  nombre_comercial text,
  rfc text,
  regimen_fiscal text,
  domicilio_fiscal text,
  ciudad text,
  estado text,
  cp text,
  telefono text,
  email text,
  registro_patronal_imss text,
  representante_legal text,
  representante_puesto text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table empleados add column if not exists empresa_id uuid references empresas(id);
create index if not exists idx_empleados_empresa on empleados(empresa_id);

-- RLS para empresas (módulo "empresas")
alter table empresas enable row level security;
drop policy if exists "modulo read" on empresas;
create policy "modulo read" on empresas for select to authenticated
  using (current_user_puede_ver('empresas'));
drop policy if exists "modulo write" on empresas;
create policy "modulo write" on empresas for all to authenticated
  using (current_user_puede_editar('empresas')) with check (current_user_puede_editar('empresas'));

-- Bitácora también
drop trigger if exists trg_bitacora on empresas;
create trigger trg_bitacora after insert or update or delete on empresas
  for each row execute function fn_bitacora_trigger();

-- Actualizar mis_modulos para incluir 'empresas'
create or replace view mis_modulos as
  select modulo, puede_editar from usuarios_modulos where user_id = auth.uid()
  union all
  select unnest(array['empleados','sucursales','puestos','horarios',
                       'asistencia','incidencias','vacaciones','actas','nomina','documentos',
                       'reportes','usuarios','capacitacion','onboarding','calculadoras',
                       'calendario','organigrama','auditoria','empresas']) as modulo,
         true as puede_editar
    where current_user_es_admin();
