import { FormEvent, useEffect, useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  Documento,
  eliminarDocumento,
  getSignedUrl,
  listDocumentos,
  subirDocumento,
  tiposDocumento,
} from '@/services/documentosService';

export default function EmpleadoDocsPanel({ empleadoId }: { empleadoId: string }) {
  const [rows, setRows] = useState<Documento[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    setRows(await listDocumentos({ empleadoId }));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Subir documento
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Emisión</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  Sin documentos.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{d.tipo}</td>
                <td className="px-3 py-2">{d.nombre}</td>
                <td className="px-3 py-2">{d.fecha_emision ?? '—'}</td>
                <td className="px-3 py-2">{d.fecha_vencimiento ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => window.open(await getSignedUrl(d.storage_path), '_blank')}
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (confirm('¿Eliminar?')) {
                        await eliminarDocumento(d.id, d.storage_path);
                        await load();
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubirForm
        empleadoId={empleadoId}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function SubirForm({
  empleadoId,
  open,
  onClose,
  onSaved,
}: {
  empleadoId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState('Contrato');
  const [nombre, setNombre] = useState('');
  const [emision, setEmision] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo('Contrato');
      setNombre('');
      setEmision('');
      setVencimiento('');
      setFile(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      await subirDocumento({
        empleado_id: empleadoId,
        tipo,
        nombre: nombre || file.name,
        file,
        fecha_emision: emision || undefined,
        fecha_vencimiento: vencimiento || undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir documento">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Select
          label="Tipo"
          options={tiposDocumento.map((t) => ({ value: t, label: t }))}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        />
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Emisión"
            type="date"
            value={emision}
            onChange={(e) => setEmision(e.target.value)}
          />
          <Input
            label="Vencimiento"
            type="date"
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value)}
          />
        </div>
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
          <Button type="submit" loading={saving} disabled={!file}>
            Subir
          </Button>
        </div>
      </form>
    </Modal>
  );
}
