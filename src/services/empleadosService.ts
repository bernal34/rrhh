import { supabase } from '@/lib/supabase';

export type Empleado = {
  id: string;
  codigo: string | null;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sucursal_id: string | null;
  puesto_id: string | null;
  fecha_ingreso: string;
  fecha_baja: string | null;
  motivo_baja: string | null;
  estatus: 'activo' | 'baja' | 'permiso' | 'vacaciones';
  foto_url: string | null;
  jefe_id?: string | null;
};

export async function listEmpleados(filtros?: { sucursal_id?: string; estatus?: string }) {
  let q = supabase.from('empleados').select('*').order('nombre');
  if (filtros?.sucursal_id) q = q.eq('sucursal_id', filtros.sucursal_id);
  if (filtros?.estatus) q = q.eq('estatus', filtros.estatus);
  const { data, error } = await q;
  if (error) throw error;
  return data as Empleado[];
}

export async function getEmpleado(id: string) {
  const { data, error } = await supabase.from('empleados').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Empleado;
}

export async function upsertEmpleado(emp: Partial<Empleado>) {
  const esAlta = !emp.id;
  const { data, error } = await supabase.from('empleados').upsert(emp).select().single();
  if (error) throw error;

  // Flujo híbrido: al crear un empleado, se crea también en HCC (solo datos, sin foto).
  // El enrollment facial lo hace un gerente en el dispositivo; la foto regresa vía webhook.
  if (esAlta && data) {
    supabase.functions
      .invoke('hik-create-person', { body: { empleado_id: data.id } })
      .catch((e) => console.warn('Alta en HCC falló (se puede reintentar manualmente):', e));
  }
  return data as Empleado;
}

export async function darDeBaja(id: string, motivo: string) {
  const { error } = await supabase
    .from('empleados')
    .update({
      estatus: 'baja',
      fecha_baja: new Date().toISOString().slice(0, 10),
      motivo_baja: motivo,
    })
    .eq('id', id);
  if (error) throw error;
}

// --- HikCentral Connect: sync unidireccional HCC -> portal ---

export async function syncFotoDesdeHik(empleadoId: string) {
  const { data, error } = await supabase.functions.invoke('hik-sync-foto', {
    body: { empleado_id: empleadoId },
  });
  if (error) throw error;
  return data as { results: Array<{ ok: boolean; reason?: string; foto_url?: string }> };
}

export async function importarDesdeHik(siteIndexCode?: string, onlyNew = true) {
  const { data, error } = await supabase.functions.invoke('hik-import-personas', {
    body: { siteIndexCode, onlyNew },
  });
  if (error) throw error;
  return data as { ok: boolean; created: number; updated: number; fotos_enqueued: number };
}

export async function getHikMapping(empleadoId: string) {
  const { data } = await supabase
    .from('empleado_hikvision_map')
    .select('hik_person_id, hik_org_index_code, last_sync_at')
    .eq('empleado_id', empleadoId)
    .maybeSingle();
  return data;
}
