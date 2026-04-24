import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Nota, TipoNota, crearNota, eliminarNota, listNotas } from '@/services/notasService';

const tipoColor: Record<TipoNota, string> = {
  general: 'bg-slate-100 text-slate-700',
  incidencia: 'bg-yellow-100 text-yellow-700',
  amonestacion: 'bg-red-100 text-red-700',
  reconocimiento: 'bg-green-100 text-green-700',
};

export default function EmpleadoNotasPanel({ empleadoId }: { empleadoId: string }) {
  const [rows, setRows] = useState<Nota[]>([]);
  const [tipo, setTipo] = useState<TipoNota>('general');
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setRows(await listNotas(empleadoId));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contenido.trim()) return;
    setSaving(true);
    try {
      await crearNota({ empleado_id: empleadoId, tipo, titulo: titulo || null, contenido });
      setTitulo('');
      setContenido('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[150px_1fr]">
          <Select
            options={[
              { value: 'general', label: 'General' },
              { value: 'incidencia', label: 'Incidencia' },
              { value: 'amonestacion', label: 'Amonestación' },
              { value: 'reconocimiento', label: 'Reconocimiento' },
            ]}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoNota)}
          />
          <Input
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <textarea
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          rows={3}
          placeholder="Escribe la nota…"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" loading={saving} disabled={!contenido.trim()}>
            Agregar nota
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {rows.length === 0 && <div className="text-sm text-slate-500">Sin notas.</div>}
        {rows.map((n) => (
          <div key={n.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoColor[n.tipo]}`}
                >
                  {n.tipo}
                </span>
                {n.titulo && <span className="font-semibold text-slate-800">{n.titulo}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {new Date(n.created_at).toLocaleString()}
                <button
                  onClick={async () => {
                    if (confirm('¿Eliminar nota?')) {
                      await eliminarNota(n.id);
                      await load();
                    }
                  }}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{n.contenido}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
