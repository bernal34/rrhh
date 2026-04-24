import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Rol = 'admin_rh' | 'gerente' | 'empleado' | null;

export type ModulosMap = Record<string, { ver: boolean; editar: boolean }>;

type AuthCtx = {
  user: User | null;
  session: Session | null;
  rol: Rol;
  modulos: ModulosMap;
  loading: boolean;
  puedeVer: (modulo: string) => boolean;
  puedeEditar: (modulo: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  reloadModulos: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol>(null);
  const [modulos, setModulos] = useState<ModulosMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadModulos(userId: string) {
    const { data } = await supabase.from('mis_modulos').select('modulo, puede_editar');
    const map: ModulosMap = {};
    (data ?? []).forEach((r: { modulo: string; puede_editar: boolean }) => {
      map[r.modulo] = { ver: true, editar: !!r.puede_editar };
    });
    setModulos(map);
    void userId;
  }

  useEffect(() => {
    if (!session?.user) {
      setRol(null);
      setModulos({});
      return;
    }
    supabase
      .from('usuarios_rol')
      .select('rol')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setRol((data?.rol as Rol) ?? 'empleado'));
    void loadModulos(session.user.id);
  }, [session?.user?.id]);

  const value: AuthCtx = {
    user: session?.user ?? null,
    session,
    rol,
    modulos,
    loading,
    puedeVer: (m) => !!modulos[m]?.ver,
    puedeEditar: (m) => !!modulos[m]?.editar,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async reloadModulos() {
      if (session?.user) await loadModulos(session.user.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
