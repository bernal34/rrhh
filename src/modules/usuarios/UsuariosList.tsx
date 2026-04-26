import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  AccesoNivel,
  MODULOS,
  MODULO_LABEL,
  Modulo,
  UsuarioAdmin,
  crearUsuario,
  eliminarUsuario,
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
  const [openCrear, setOpenCrear] = useState(false);

  async function onEliminar(u: UsuarioAdmin) {
    if (!confirm(`¿Eliminar PERMANENTEMENTE al usuario ${u.email}? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarUsuario(u.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="text-brand-600" /> Usuarios y permisos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Los usuarios con rol <b>Admin RH</b> tienen acceso total automático.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refrescar
          </Button>
          <Button onClick={() => setOpenCrear(true)}>
            <Plus size={16} /> Nuevo usuario
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2"></th>
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
                <td colSpan={3 + MODULOS.length} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan={3 + MODULOS.length} className="px-4 py-6 text-center text-slate-500">
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
                  <td className="px-2 py-2 align-top">
                    <button
                      onClick={() => onEliminar(u)}
                      title="Eliminar usuario"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
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

      <CrearUsuarioModal
        open={openCrear}
        onClose={() => setOpenCrear(false)}
        onCreated={() => {
          setOpenCrear(false);
          void load();
        }}
      />
    </div>
  );
}

function CrearUsuarioModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'admin_rh' | 'gerente' | 'empleado'>('empleado');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword(generaPassword());
      setRol('empleado');
      setErr(null);
    }
  }, [open]);

  function generaPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p + '!';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await crearUsuario({ email, password, rol });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear nuevo usuario">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          El usuario se crea con email <b>auto-confirmado</b>, listo para entrar al portal.
          Después podrás vincularlo a su ficha de empleado desde Empleados → Cuenta de portal asociada.
        </div>
        <Input
          label="Email *"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="empleado@empresa.com"
        />
        <div className="flex items-end gap-2">
          <Input
            label="Contraseña inicial *"
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => setPassword(generaPassword())}>
            Regenerar
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Comparte esta contraseña con el usuario; podrá cambiarla al iniciar sesión.
        </div>
        <Select
          label="Rol"
          options={[
            { value: 'empleado', label: 'Empleado (solo Mi portal)' },
            { value: 'gerente', label: 'Gerente (módulos asignables)' },
            { value: 'admin_rh', label: 'Admin RH (acceso total)' },
          ]}
          value={rol}
          onChange={(e) => setRol(e.target.value as 'admin_rh' | 'gerente' | 'empleado')}
        />
        {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!email || password.length < 6}>
            Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
}
