import { supabase } from '@/lib/supabase';

export type Sucursal = { id: string; nombre: string; activo: boolean };
export type Puesto = { id: string; nombre: string; sueldo_base_sugerido: number | null; activo: boolean };

export async function listSucursales() {
  const { data, error } = await supabase
    .from('sucursales')
    .select('id, nombre, activo')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data as Sucursal[];
}

export async function listPuestos() {
  const { data, error } = await supabase
    .from('puestos')
    .select('id, nombre, sueldo_base_sugerido, activo')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data as Puesto[];
}
