import { supabase } from '@/lib/supabase';

// dashboard NO está en esta lista: es la pantalla de inicio y todo
// usuario autenticado puede entrar (las tarjetas se filtran por RLS).
export const MODULOS = [
  'empleados',
  'sucursales',
  'puestos',
  'horarios',
  'asistencia',
  'incidencias',
  'actas',
  'nomina',
  'documentos',
  'reportes',
  'usuarios',
] as const;

export type Modulo = (typeof MODULOS)[number];

export const MODULO_LABEL: Record<Modulo, string> = {
  empleados: 'Empleados',
  sucursales: 'Sucursales / Obras',
  puestos: 'Puestos',
  horarios: 'Horarios',
  asistencia: 'Asistencia',
  incidencias: 'Incidencias',
  actas: 'Actas',
  nomina: 'Nómina',
  documentos: 'Documentos',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
};

export type PermisoModulo = { modulo: string; puede_editar: boolean };

export type UsuarioAdmin = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  rol: 'admin_rh' | 'gerente' | 'empleado' | null;
  modulos: PermisoModulo[];
};

export async function listUsuarios(): Promise<UsuarioAdmin[]> {
  const { data, error } = await supabase.rpc('list_usuarios_admin');
  if (error) throw error;
  return (data ?? []) as UsuarioAdmin[];
}

export async function setRol(userId: string, rol: 'admin_rh' | 'gerente' | 'empleado') {
  const { error } = await supabase
    .from('usuarios_rol')
    .upsert({ user_id: userId, rol });
  if (error) throw error;
}

export type AccesoNivel = 'sin' | 'lectura' | 'edicion';

export async function setPermiso(userId: string, modulo: string, nivel: AccesoNivel) {
  if (nivel === 'sin') {
    const { error } = await supabase
      .from('usuarios_modulos')
      .delete()
      .eq('user_id', userId)
      .eq('modulo', modulo);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('usuarios_modulos')
    .upsert({
      user_id: userId,
      modulo,
      puede_editar: nivel === 'edicion',
    });
  if (error) throw error;
}
