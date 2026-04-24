import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  AccesoNivel,
  MODULOS,
  MODULO_LABEL,
  Modulo,
  UsuarioAdmin,
  listUsuarios,
  setPermiso,
  setRol,
} from '@/services/permisosService';

const ROLES: Array<{ value: 'admin_rh' | 'gerente' | 'empleado'; label: string }> = [
  { value: 'admin_rh', label: 'Admin RH' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'empleado', label: 'Empleado' },
];

function nivelDe(u: UsuarioAdmin, mod: string): AccesoNivel {
  const m = u.modulos.find((p) => p.modulo === mod);
  if (!m) return 'sin';
  return m.puede_editar ? 'edicion' : 'lectura';
}

export default function UsuariosList() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setUsuarios(await listUsuarios());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCambiaRol(u: UsuarioAdmin, nuevo: 'admin_rh' | 'gerente' | 'empleado') {
    const key = `${u.id}:rol`;
    setSavingKey(key);
    try {
      await setRol(u.id, nuevo);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingKey(null);
    }
  }

  async function onCambiaPermiso(u: UsuarioAdmin, mod: Modulo, nivel: AccesoNivel) {
    const key = `${u.id}:${mod}`;
    setSavingKey(key);
    try {
      await setPermiso(u.id, mod, nivel);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios y permisos</h1>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck size={16} className="text-brand-600" />
          Los usuarios con rol <b className="mx-1">Admin RH</b> tienen acceso total automático.
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Para crear nuevos usuarios usa{' '}
        <a
          className="font-medium underline"
          href="https://supabase.com/dashboard/project/_/auth/users"
          target="_blank"
          rel="noreferrer"
        >
          Supabase → Authentication → Users → Add user
        </a>
        . Luego aparecerán aquí para asignarles rol y permisos.
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Rol</th>
              {MODULOS.map((m) => (
                <th key={m} className="px-3 py-2 text-center">
                  {MODULO_LABEL[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={2 + MODULOS.length} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan={2 + MODULOS.length} className="px-4 py-6 text-center text-slate-500">
                  Sin usuarios.
                </td>
              </tr>
            )}
            {usuarios.map((u) => {
              const esAdmin = u.rol === 'admin_rh';
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top">
                    <div className="font-medium text-slate-800">{u.email}</div>
                    <div className="text-xs text-slate-500">
                      {u.last_sign_in_at
                        ? `Último ingreso: ${new Date(u.last_sign_in_at).toLocaleDateString()}`
                        : 'Nunca ha entrado'}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={u.rol ?? 'empleado'}
                      disabled={savingKey === `${u.id}:rol`}
                      onChange={(e) =>
                        onCambiaRol(u, e.target.value as 'admin_rh' | 'gerente' | 'empleado')
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {MODULOS.map((mod) => {
                    const nivel = esAdmin ? 'edicion' : nivelDe(u, mod);
                    const key = `${u.id}:${mod}`;
                    return (
                      <td key={mod} className="px-2 py-2 text-center align-top">
                        <select
                          className={`rounded border px-1.5 py-1 text-xs ${
                            nivel === 'edicion'
                              ? 'border-green-300 bg-green-50 text-green-800'
                              : nivel === 'lectura'
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                          value={nivel}
                          disabled={esAdmin || savingKey === key}
                          onChange={(e) =>
                            onCambiaPermiso(u, mod, e.target.value as AccesoNivel)
                          }
                          title={
                            esAdmin
                              ? 'Admin RH tiene acceso total automáticamente'
                              : undefined
                          }
                        >
                          <option value="sin">Sin acceso</option>
                          <option value="lectura">Solo lectura</option>
                          <option value="edicion">Edición</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
