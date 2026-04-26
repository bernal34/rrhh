// Crea usuarios de Auth desde el portal (admin only).
// Requiere service_role para llamar auth.admin.createUser.
//
// Body: { email: string, password: string, rol?: 'admin_rh'|'gerente'|'empleado' }
// Retorna: { user_id: string, email: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const { email, password, rol } = body as {
      email: string;
      password: string;
      rol?: 'admin_rh' | 'gerente' | 'empleado';
    };

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email y password son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'password mínimo 6 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente con anon key para verificar quién llama (debe ser admin_rh)
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: callerData } = await callerClient.auth.getUser();
    if (!callerData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica que el caller sea admin_rh
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: rolRow } = await adminClient
      .from('usuarios_rol')
      .select('rol')
      .eq('user_id', callerData.user.id)
      .maybeSingle();
    if (rolRow?.rol !== 'admin_rh') {
      return new Response(JSON.stringify({ error: 'Solo admin_rh puede crear usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Crear el usuario con email confirmado
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Asignar rol (default: empleado)
    const rolFinal = rol ?? 'empleado';
    await adminClient.from('usuarios_rol').upsert({
      user_id: created.user.id,
      rol: rolFinal,
    });

    return new Response(
      JSON.stringify({
        user_id: created.user.id,
        email: created.user.email,
        rol: rolFinal,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
