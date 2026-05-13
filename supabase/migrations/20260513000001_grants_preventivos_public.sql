-- ============================================================
-- Grants preventivos en public: anon / authenticated / service_role
-- ============================================================
-- Supabase está cambiando el default: nuevas tablas en `public` ya no
-- recibirán grants implícitos vía PostgREST. Aplica a proyectos
-- existentes el 30-oct-2026.
--
-- Esta migración recorre TODAS las tablas, vistas y secuencias de
-- `public` ya creadas y les aplica grants explícitos para que sigan
-- funcionando si Supabase termina extendiendo el cambio a tablas
-- existentes. Es idempotente — se puede correr múltiples veces.
--
-- Recuerda: las grants son la primera capa; RLS sigue controlando qué
-- filas ve cada usuario. Granting anon SELECT en una tabla con RLS
-- estricta no expone datos — anon sigue siendo bloqueado por las
-- policies en uso (que casi todas requieren `authenticated`).
-- ============================================================

do $$
declare
  t text;
begin
  -- Tablas
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;

  -- Vistas (anon/authenticated solo necesitan SELECT)
  for t in
    select viewname from pg_views where schemaname = 'public'
  loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select on public.%I to service_role', t);
  end loop;

  -- Secuencias (necesarias para INSERT en tablas con bigserial / serial)
  for t in
    select sequence_name from information_schema.sequences where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence public.%I to anon', t);
    execute format('grant usage, select, update on sequence public.%I to authenticated', t);
    execute format('grant usage, select, update on sequence public.%I to service_role', t);
  end loop;
end $$;

-- Defaults para objetos FUTUROS creados por el rol postgres en public.
-- Esto NO es lo mismo que el comportamiento implícito de Supabase que
-- van a quitar, pero ayuda a que si alguien crea una tabla manualmente
-- en el SQL Editor también herede los grants básicos.
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon;
alter default privileges in schema public
  grant usage, select, update on sequences to authenticated;
alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
