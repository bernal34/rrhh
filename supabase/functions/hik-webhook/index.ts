// Recibe eventos push de HikCentral Connect en tiempo real.
// Dos tipos de payload interesantes:
//   1) Checadas / eventos de acceso  -> se insertan en `checadas`.
//   2) Eventos de persona (enroll, foto actualizada) -> disparan sync de foto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type HikEvent = {
  eventId: string;
  eventType?: string | number;
  eventTime: string;
  personId?: string;
  deviceName?: string;
  siteIndexCode?: string;
  [k: string]: unknown;
};

// Heurística: eventos cuyo tipo indica cambio de datos/foto de persona.
// Ajustar según el código exacto de evento que mande HCC en tu tenant.
const PERSON_EVENT_KEYWORDS = ['person', 'face', 'enroll', 'picture', 'photo'];

function isPersonEvent(ev: HikEvent): boolean {
  const t = String(ev.eventType ?? '').toLowerCase();
  return PERSON_EVENT_KEYWORDS.some((k) => t.includes(k));
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('HIK_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || provided !== expected) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const events: HikEvent[] = Array.isArray(payload) ? payload : payload.events ?? [payload];

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const empleadosParaFoto = new Set<string>();
  let checadas = 0;

  for (const ev of events) {
    // Resuelve empleado por mapping
    let empleadoId: string | null = null;
    if (ev.personId) {
      const { data: map } = await supabase
        .from('empleado_hikvision_map')
        .select('empleado_id')
        .eq('hik_person_id', ev.personId)
        .maybeSingle();
      empleadoId = map?.empleado_id ?? null;
    }

    if (isPersonEvent(ev)) {
      if (empleadoId) empleadosParaFoto.add(empleadoId);
      continue;
    }

    // Checada / evento de acceso
    await supabase.from('checadas').upsert(
      {
        empleado_id: empleadoId,
        fecha_hora: ev.eventTime,
        dispositivo: ev.deviceName,
        hik_event_id: ev.eventId,
        hik_person_id: ev.personId,
        raw: ev,
      },
      { onConflict: 'hik_event_id' },
    );
    checadas++;
  }

  // Dispara sync de foto para los empleados afectados (fire-and-forget).
  if (empleadosParaFoto.size > 0) {
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/hik-sync-foto`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ empleado_ids: Array.from(empleadosParaFoto) }),
    }).catch(() => {});
  }

  return new Response(
    JSON.stringify({
      ok: true,
      checadas,
      fotos_sync: empleadosParaFoto.size,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
