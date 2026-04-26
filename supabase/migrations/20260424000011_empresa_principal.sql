-- ============================================================
-- Empresa principal (toggle - solo una a la vez puede ser principal)
-- ============================================================

alter table empresas add column if not exists principal boolean not null default false;

-- Índice único parcial: solo una empresa puede tener principal=true
create unique index if not exists uq_empresa_principal
  on empresas (principal) where principal = true;
