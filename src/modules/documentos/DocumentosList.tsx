import { FormEvent, useEffect, useState } from 'react';
import { Plus, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  Documento,
  eliminarDocumento,
  getSignedUrl,
  listDocumentos,
  subirDocumento,
  tiposDocumento,
} from '@/services/documentosService';
import { Empleado, listEmpleados } from '@/services/empleadosService';

function diasHasta(fecha?: string | null): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  const ahora = new Date();
  return Math.ceil((d.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
}

function badgeVencimiento(dias: number | null) {
  if (dias == null) return null;
  if (dias < 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"><AlertTriangle size={12} /> Vencido</span>;
  if (dias <= 30)
    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Vence en {dias}d</span>;
  return <span className="text-xs text-slate-500">{dias}d</span>;
}

export default function DocumentosList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('documentos');
  const [rows, setRows] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [porVencer, setPorVencer] = useState(false);
  const [tipo, setTipo] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listDocumentos({ porVencer, tipo: tipo || undefined }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porVencer, tipo]);

  async function onVer(d: Documento) {
    const url = await getSignedUrl(d.storage_path);
    window.open(url, '_blank');
  }

  async function onBorrar(d: Documento) {
    if (!confirm(`¿Eliminar documento "${d.nombre}"?`)) return;
    await eliminarDocumento(d.id, d.storage_path);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documentos</h1>
        {editar && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Subir documento
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select
          className="max-w-xs"
          label="Tipo"
          placeholder="Todos"
          options={tiposDocumento.map((t) => ({ value: t, label: t }))}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={porVencer}
            onChange={(e) => setPorVencer(e.target.checked)}
          />
          Solo por vencer (≤ 30 días)
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Emisión</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3 text-right">Acciones</th>
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
                  Sin documentos.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {d.empleado
                    ? `${d.empleado.nombre} ${d.empleado.apellido_paterno ?? ''}`.trim()
                    : '—'}
                  <div className="text-xs text-slate-500">{d.empleado?.codigo ?? '—'}</div>
                </td>
                <td className="px-4 py-2">{d.tipo}</td>
                <td className="px-4 py-2">{d.nombre}</td>
                <td className="px-4 py-2">{d.fecha_emision ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {d.fecha_vencimiento ?? '—'}
                    {badgeVencimiento(diasHasta(d.fecha_vencimiento))}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onVer(d)}>
                    <Eye size={14} />
                  </Button>
                  {editar && (
                    <Button variant="ghost" size="sm" onClick={() => onBorrar(d)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubirForm open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void load(); }} />
    </div>
  );
}

function SubirForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleado_id, setEmpleadoId] = useState('');
  const [tipo, setTipo] = useState('Contrato');
  const [nombre, setNombre] = useState('');
  const [emision, setEmision] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [nota, setNota] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) listEmpleados({ estatus: 'activo' }).then(setEmpleados);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      await subirDocumento({
        empleado_id,
        tipo,
        nombre: nombre || file.name,
        file,
        fecha_emision: emision || undefined,
        fecha_vencimiento: vencimiento || undefined,
        nota: nota || undefined,
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir documento">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`,
          }))}
          value={empleado_id}
          onChange={(e) => setEmpleadoId(e.target.value)}
        />
        <Select
          label="Tipo"
          options={tiposDocumento.map((t) => ({ value: t, label: t }))}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        />
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha emisión"
            type="date"
            value={emision}
            onChange={(e) => setEmision(e.target.value)}
          />
          <Input
            label="Fecha vencimiento"
            type="date"
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value)}
          />
        </div>
        <Input label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        <div>
          <label className="text-sm font-medium text-slate-700">Archivo *</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!empleado_id || !file}>
            Subir
          </Button>
        </div>
      </form>
    </Modal>
  );
}
