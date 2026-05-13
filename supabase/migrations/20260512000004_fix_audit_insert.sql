-- ============================================================
-- Fix: fn_editar_asistencia_manual debe correr como SECURITY DEFINER
-- ============================================================
-- bitacora_auditoria tiene RLS habilitado y solo política SELECT
-- (para admins). El trigger fn_bitacora_trigger es SECURITY DEFINER
-- para poder insertar; replicamos el patrón en esta función para
-- que el INSERT al log no falle cuando el usuario no es admin.
-- ============================================================

create or replace function fn_editar_asistencia_manual(
  p_id         uuid,
  p_entrada    timestamptz,
  p_salida     timestamptz,
  p_falta      boolean,
  p_incidencia text,
  p_motivo     text
) returns asistencia_dia
language plpgsql
security definer
set search_path = public
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
