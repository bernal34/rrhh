// Sincroniza la foto facial de un empleado desde HikCentral Connect al bucket 'empleados-fotos'.
// Input: { empleado_id }  (o { empleado_ids: [...] } para sync en batch)
// Flujo:
//   1) Lee hik_person_id de empleado_hikvision_map
//   2) Pide a HCC la URL temporal de la foto (personPhoto)
//   3) Descarga el binario, lo sube a Supabase Storage y actualiza empleados.foto_url

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hikFetch } from '../_shared/hikvision-signer.ts';

const BUCKET = 'empleados-fotos';

type HikPersonInfo = {
  code: string;
  msg: string;
  data?: {
    personId: string;
    personName?: string;
    personPhoto?: { picUri?: string; picUrl?: string };
  };
};

async function syncOne(supabase: ReturnType<typeof createClient>, empleadoId: string) {
  const { data: map } = await supabase
    .from('empleado_hikvision_map')
    .select('hik_person_id')
    .eq('empleado_id', empleadoId)
    .maybeSingle();

  if (!map?.hik_person_id) {
    return { empleadoId, ok: false, reason: 'sin mapping HCC' };
  }

  const info = await hikFetch<HikPersonInfo>('/artemis/api/resource/v1/person/single/personInfo', {
    method: 'POST',
    body: { personId: map.hik_person_id },
  });

  const picUrl = info.data?.personPhoto?.picUrl || info.data?.personPhoto?.picUri;
  if (!picUrl) {
    return { empleadoId, ok: false, reason: 'HCC no devolvió foto' };
  }

  const imgResp = await fetch(picUrl);
  if (!imgResp.ok) {
    return { empleadoId, ok: false, reason: `descarga falló: ${imgResp.status}` };
  }
  const bytes = new Uint8Array(await imgResp.arrayBuffer());
  const contentType = imgResp.headers.get('content-type') ?? 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const path = `${empleadoId}/facial-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (upErr) return { empleadoId, ok: false, reason: upErr.message };

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await supabase.from('empleados').update({ foto_url: pub.publicUrl }).eq('id', empleadoId);
  await supabase
    .from('empleado_hikvision_map')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('empleado_id', empleadoId);

  return { empleadoId, ok: true, foto_url: pub.publicUrl };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { empleado_id, empleado_ids } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const ids: string[] = empleado_ids ?? (empleado_id ? [empleado_id] : []);
  if (ids.length === 0) return new Response('empleado_id(s) requerido', { status: 400 });

  const results = [];
  for (const id of ids) {
    try {
      results.push(await syncOne(supabase, id));
    } catch (e) {
      results.push({ empleadoId: id, ok: false, reason: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
