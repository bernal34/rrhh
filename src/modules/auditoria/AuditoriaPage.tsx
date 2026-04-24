import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

type Registro = {
  id: number;
  ts: string;
  user_email: string | null;
  tabla: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  registro_id: string;
  cambios: any;
};

const opColor: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const TABLAS = [
  'empleados',
  'sucursales',
  'puestos',
  'incidencias',
  'actas_administrativas',
  'periodos_nomina',
  'prenomina',
  'usuarios_modulos',
  'usuarios_rol',
];

export default function AuditoriaPage() {
  const [rows, setRows] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabla, setTabla] = useState('');
  const [op, setOp] = useState('');
  const [usuario, setUsuario] = useState('');
  const [expand, setExpand] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from('bitacora_auditoria').select('*').order('ts', { ascending: false }).limit(200);
    if (tabla) q = q.eq('tabla', tabla);
    if (op) q = q.eq('operacion', op);
    if (usuario) q = q.ilike('user_email', `%${usuario}%`);
    const { data } = await q;
    setRows((data ?? []) as Registro[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, op, usuario]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Activity className="text-brand-600" />
        <h1 className="text-2xl font-semibold">Bitácora de auditoría</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          últimos 200 eventos
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4">
        <Select
          label="Tabla"
          placeholder="Todas"
          options={TABLAS.map((t) => ({ value: t, label: t }))}
          value={tabla}
          onChange={(e) => setTabla(e.target.value)}
        />
        <Select
          label="Operación"
          placeholder="Todas"
          options={[
            { value: 'INSERT', label: 'Crear' },
            { value: 'UPDATE', label: 'Modificar' },
            { value: 'DELETE', label: 'Borrar' },
          ]}
          value={op}
          onChange={(e) => setOp(e.target.value)}
        />
        <Input
          label="Usuario (email)"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <div className="flex items-end">
          <Button variant="secondary" onClick={load} className="w-full">
            Refrescar
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha / hora</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Tabla</th>
              <th className="px-4 py-3">Operación</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin eventos.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <>
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                    {new Date(r.ts).toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.user_email ?? 'sistema'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.tabla}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        opColor[r.operacion]
                      }`}
                    >
                      {r.operacion}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {r.registro_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-xs text-brand-600 hover:underline"
                      onClick={() => setExpand(expand === r.id ? null : r.id)}
                    >
                      {expand === r.id ? 'Ocultar' : 'Ver cambios'}
                    </button>
                  </td>
                </tr>
                {expand === r.id && (
                  <tr key={`${r.id}-d`} className="bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(r.cambios, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
