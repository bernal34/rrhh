// Importa personas desde HikCentral Connect al portal.
// Crea/actualiza empleados por (codigo | hik_person_id), mapea a sucursal si existe,
// y dispara hik-sync-foto por cada uno para traer la foto facial.
//
// Input opcional: { siteIndexCode, onlyNew: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hikFetch } from '../_shared/hikvision-signer.ts';

type HikPerson = {
  personId: string;
  personCode?: string;
  personName?: string;
  lastName?: string;
  firstName?: string;
  phoneNo?: string;
  email?: string;
  orgIndexCode?: string;
  personPhoto?: { picUri?: string; picUrl?: string };
};

type PersonListResp = {
  code: string;
  msg: string;
  data?: { total: number; pageNo: number; pageSize: number; list: HikPerson[] };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { siteIndexCode, onlyNew = false } = await req.json().catch(() => ({}));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resuelve mapeo sucursal HCC -> sucursal portal
  const { data: sucMaps } = await supabase
    .from('sucursal_hikvision_map')
    .select('sucursal_id, hik_site_index_code');
  const sucursalByHik = new Map((sucMaps ?? []).map((m) => [m.hik_site_index_code, m.sucursal_id]));

  let pageNo = 1;
  const pageSize = 200;
  const created: string[] = [];
  const updated: string[] = [];
  const fotoQueue: string[] = [];

  while (true) {
    const resp = await hikFetch<PersonListResp>(
      '/artemis/api/resource/v1/person/advance/personList',
      {
        method: 'POST',
        body: { pageNo, pageSize, ...(siteIndexCode ? { orgIndexCodes: [siteIndexCode] } : {}) },
      },
    );
    const list = resp.data?.list ?? [];
    if (list.length === 0) break;

    for (const p of list) {
      // ¿Ya existe mapping?
      const { data: existingMap } = await supabase
        .from('empleado_hikvision_map')
        .select('empleado_id')
        .eq('hik_person_id', p.personId)
        .maybeSingle();

      if (onlyNew && existingMap) continue;

      const nombre = p.firstName ?? p.personName?.split(' ')[0] ?? '(sin nombre)';
      const apellidoPaterno = p.lastName ?? p.personName?.split(' ').slice(1).join(' ') ?? null;
      const sucursalId = p.orgIndexCode ? sucursalByHik.get(p.orgIndexCode) ?? null : null;

      let empleadoId = existingMap?.empleado_id as string | undefined;

      if (empleadoId) {
        await supabase
          .from('empleados')
          .update({
            codigo: p.personCode ?? null,
            nombre,
            apellido_paterno: apellidoPaterno,
            telefono: p.phoneNo ?? null,
            email: p.email ?? null,
            sucursal_id: sucursalId,
          })
          .eq('id', empleadoId);
        updated.push(empleadoId);
      } else {
        const { data: inserted, error } = await supabase
          .from('empleados')
          .insert({
            codigo: p.personCode ?? null,
            nombre,
            apellido_paterno: apellidoPaterno,
            telefono: p.phoneNo ?? null,
            email: p.email ?? null,
            sucursal_id: sucursalId,
            fecha_ingreso: new Date().toISOString().slice(0, 10),
            estatus: 'activo',
          })
          .select('id')
          .single();
        if (error) continue;
        empleadoId = inserted.id;
        created.push(empleadoId);

        await supabase.from('empleado_hikvision_map').insert({
          empleado_id: empleadoId,
          hik_person_id: p.personId,
          hik_org_index_code: p.orgIndexCode ?? null,
        });
      }

      if (empleadoId && (p.personPhoto?.picUrl || p.personPhoto?.picUri)) {
        fotoQueue.push(empleadoId);
      }
    }

    if (list.length < pageSize) break;
    pageNo++;
  }

  // Dispara sync de fotos en batch (fire-and-forget)
  if (fotoQueue.length > 0) {
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/hik-sync-foto`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ empleado_ids: fotoQueue }),
    }).catch(() => {});
  }

  return new Response(
    JSON.stringify({
      ok: true,
      created: created.length,
      updated: updated.length,
      fotos_enqueued: fotoQueue.length,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
