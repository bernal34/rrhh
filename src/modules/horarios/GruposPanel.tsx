import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useCatalogos } from '@/hooks/useCatalogos';
import { useAuth } from '@/lib/auth';
import {
  GrupoHorario,
  Turno,
  deleteGrupo,
  getGrupoTurnoDias,
  listGrupos,
  listTurnos,
  setGrupoTurnoDia,
  upsertGrupo,
} from '@/services/horariosService';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function GruposPanel() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('horarios');
  const [grupos, setGrupos] = useState<GrupoHorario[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoHorario | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([listGrupos(true), listTurnos(true)]);
      setGrupos(g);
      setTurnos(t);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {editar && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={16} /> Nuevo grupo
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading && <div className="text-slate-500">Cargando…</div>}
        {!loading && grupos.length === 0 && <div className="text-slate-500">Sin grupos.</div>}
        {grupos.map((g) => (
          <GrupoCard
            key={g.id}
            grupo={g}
            turnos={turnos}
            editar={editar}
            onEdit={() => {
              setEditing(g);
              setOpen(true);
            }}
            onDelete={async () => {
              if (confirm(`¿Desactivar grupo "${g.nombre}"?`)) {
                await deleteGrupo(g.id);
                await load();
              }
            }}
          />
        ))}
      </div>

      <GrupoForm
        open={open}
        onClose={() => setOpen(false)}
        grupo={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function GrupoCard({
  grupo,
  turnos,
  editar,
  onEdit,
  onDelete,
}: {
  grupo: GrupoHorario;
  turnos: Turno[];
  editar: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [dias, setDias] = useState<Record<number, string | null>>({});
  const turnoById = Object.fromEntries(turnos.map((t) => [t.id, t]));

  useEffect(() => {
    getGrupoTurnoDias(grupo.id).then((rows) => {
      const m: Record<number, string | null> = {};
      rows.forEach((r) => (m[r.dia_semana] = r.turno_id));
      setDias(m);
    });
  }, [grupo.id]);

  async function onCambiar(dia: number, turnoId: string) {
    const tid = turnoId || null;
    setDias((d) => ({ ...d, [dia]: tid }));
    await setGrupoTurnoDia(grupo.id, dia, tid);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold text-slate-800">{grupo.nombre}</div>
          <div className="text-xs text-slate-500">{grupo.descripcion ?? '—'}</div>
        </div>
        {editar && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              Borrar
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {DIAS.map((dia, idx) => {
          const turnoId = dias[idx] ?? '';
          const turno = turnoId ? turnoById[turnoId] : null;
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="text-center font-medium text-slate-600">{dia}</div>
              <select
                value={turnoId}
                disabled={!editar}
                onChange={(e) => onCambiar(idx, e.target.value)}
                className="rounded border border-slate-300 bg-white px-1 py-1 text-xs outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                style={turno ? { background: `${turno.color}15`, borderColor: turno.color ?? undefined } : {}}
              >
                <option value="">Descanso</option>
                {turnos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GrupoForm({
  open,
  onClose,
  grupo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  grupo: GrupoHorario | null;
  onSaved: () => void;
}) {
  const { sucursales } = useCatalogos();
  const [form, setForm] = useState<Partial<GrupoHorario>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(grupo ?? { nombre: '', descripcion: '', sucursal_id: null });
  }, [open, grupo]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertGrupo({ ...form, sucursal_id: form.sucursal_id || null });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={grupo ? 'Editar grupo' : 'Nuevo grupo'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nombre *"
          required
          value={form.nombre ?? ''}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <Input
          label="Descripción"
          value={form.descripcion ?? ''}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />
        <Select
          label="Sucursal"
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          placeholder="Todas / ninguna"
          value={form.sucursal_id ?? ''}
          onChange={(e) => setForm({ ...form, sucursal_id: e.target.value || null })}
        />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
