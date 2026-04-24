// Pull periódico de checadas desde HikCentral Connect.
// Ejecutar con pg_cron / Supabase Scheduled Functions cada 5-10 min como respaldo del webhook.
//
// Deploy:
//   supabase functions deploy hik-sync-checadas

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hikFetch } from '../_shared/hikvision-signer.ts';

type HikAcsRecord = {
  eventId: string;
  personId?: string;
  personName?: string;
  siteIndexCode?: string;
  deviceName?: string;
  eventTime: string;         // ISO 8601
  eventType?: number | string;
};

type HikAcsPage = {
  code: string;
  msg: string;
  data?: {
    total: number;
    pageNo: number;
    pageSize: number;
    list: HikAcsRecord[];
  };
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Última sincronización
  const { data: integ } = await supabase
    .from('integracion_hikvision')
    .select('ultimo_sync')
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  const startTime = integ?.ultimo_sync ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const endTime = new Date().toISOString();

  let pageNo = 1;
  const pageSize = 200;
  let inserted = 0;

  while (true) {
    const resp = await hikFetch<HikAcsPage>('/artemis/api/acs/v1/door/events', {
      method: 'POST',
      body: { startTime, endTime, pageNo, pageSize },
    });

    const list = resp.data?.list ?? [];
    if (list.length === 0) break;

    for (const ev of list) {
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

      const { error } = await supabase.from('checadas').upsert(
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
      if (!error) inserted++;
    }

    if (list.length < pageSize) break;
    pageNo++;
  }

  await supabase
    .from('integracion_hikvision')
    .update({ ultimo_sync: endTime })
    .eq('activo', true);

  return new Response(JSON.stringify({ ok: true, inserted, startTime, endTime }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
