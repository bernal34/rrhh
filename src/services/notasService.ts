import { supabase } from '@/lib/supabase';

export type TipoNota = 'incidencia' | 'amonestacion' | 'reconocimiento' | 'general';

export type Nota = {
  id: string;
  empleado_id: string;
  tipo: TipoNota;
  titulo: string | null;
  contenido: string;
  created_at: string;
  created_by: string | null;
};

export async function listNotas(empleadoId: string) {
  const { data, error } = await supabase
    .from('notas')
    .select('*')
    .eq('empleado_id', empleadoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Nota[];
}

export async function crearNota(n: Partial<Nota>) {
  const { data, error } = await supabase.from('notas').insert(n).select().single();
  if (error) throw error;
  return data as Nota;
}

export async function eliminarNota(id: string) {
  const { error } = await supabase.from('notas').delete().eq('id', id);
  if (error) throw error;
}
