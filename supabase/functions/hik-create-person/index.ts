// Crea una persona en HikCentral Connect a partir de un empleado del portal.
// Invocar desde el frontend con supabase.functions.invoke('hik-create-person', { body: { empleado_id } }).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hikFetch } from '../_shared/hikvision-signer.ts';

type HikPersonAddResp = {
  code: string;
  msg: string;
  data?: { personId: string };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { empleado_id } = await req.json();
  if (!empleado_id) return new Response('empleado_id requerido', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: emp, error } = await supabase
    .from('empleados')
    .select('id, codigo, nombre, apellido_paterno, apellido_materno, sucursal_id, telefono, email')
    .eq('id', empleado_id)
    .single();

  if (error || !emp) return new Response('empleado no encontrado', { status: 404 });

  const { data: sucMap } = await supabase
    .from('sucursal_hikvision_map')
    .select('hik_site_index_code')
    .eq('sucursal_id', emp.sucursal_id)
    .maybeSingle();

  const fullName = [emp.nombre, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' ');

  const resp = await hikFetch<HikPersonAddResp>('/artemis/api/resource/v1/person/single/add', {
    method: 'POST',
    body: {
      personCode: emp.codigo ?? emp.id,
      personName: fullName,
      orgIndexCode: sucMap?.hik_site_index_code,
      phoneNo: emp.telefono,
      email: emp.email,
    },
  });

  if (resp.code !== '0' || !resp.data?.personId) {
    return new Response(JSON.stringify({ error: resp.msg }), { status: 502 });
  }

  await supabase.from('empleado_hikvision_map').upsert({
    empleado_id: emp.id,
    hik_person_id: resp.data.personId,
    hik_org_index_code: sucMap?.hik_site_index_code ?? null,
    last_sync_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true, hik_person_id: resp.data.personId }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
