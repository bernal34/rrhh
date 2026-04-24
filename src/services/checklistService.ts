import { supabase } from '@/lib/supabase';

export type ChecklistItem = {
  id: string;
  flujo: 'onboarding' | 'offboarding';
  orden: number;
  titulo: string;
  descripcion: string | null;
  obligatorio: boolean;
  activo: boolean;
};

export type EstadoItem = {
  empleado_id: string;
  item_id: string;
  cumplido: boolean;
  cumplido_at: string | null;
  notas: string | null;
};

export async function listItems(flujo: 'onboarding' | 'offboarding') {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('flujo', flujo)
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

export async function listEstados(empleadoId: string) {
  const { data, error } = await supabase
    .from('empleado_checklist')
    .select('*')
    .eq('empleado_id', empleadoId);
  if (error) throw error;
  return (data ?? []) as EstadoItem[];
}

export async function setEstado(
  empleadoId: string,
  itemId: string,
  cumplido: boolean,
  notas?: string,
) {
  const { error } = await supabase.from('empleado_checklist').upsert({
    empleado_id: empleadoId,
    item_id: itemId,
    cumplido,
    cumplido_at: cumplido ? new Date().toISOString() : null,
    notas: notas ?? null,
  });
  if (error) throw error;
}

export async function upsertItem(item: Partial<ChecklistItem>) {
  const payload: Record<string, unknown> = {
    flujo: item.flujo,
    orden: item.orden ?? 100,
    titulo: item.titulo,
    descripcion: item.descripcion ?? null,
    obligatorio: item.obligatorio ?? true,
    activo: item.activo ?? true,
  };
  if (item.id) payload.id = item.id;
  const { error } = await supabase.from('checklist_items').upsert(payload);
  if (error) throw error;
}

export async function eliminarItem(id: string) {
  const { error } = await supabase.from('checklist_items').update({ activo: false }).eq('id', id);
  if (error) throw error;
}
