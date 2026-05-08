import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  BatchModo,
  GrupoHorario,
  asignarGrupoBatch,
  listGrupos,
} from '@/services/horariosService';

type Props = {
  open: boolean;
  onClose: () => void;
  empleadoIds: string[]; // ids ya filtrados de la lista visible
  onApplied: () => void;
};

export default function EmpleadoHorarioBatchModal({
  open,
  onClose,
  empleadoIds,
  onApplied,
}: Props) {
  const [grupos, setGrupos] = useState<GrupoHorario[]>([]);
  const [grupoId, setGrupoId] = useState('');
  const [modo, setModo] = useState<BatchModo>('solo-sin-grupo');
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<{ asignados: number; ya_tenian: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResultado(null);
    setError(null);
    listGrupos(true)
      .then(setGrupos)
      .catch(() => setGrupos([]));
  }, [open]);

  async function aplicar() {
    if (!grupoId) return;
    setAplicando(true);
    setError(null);
    try {
      const res = await asignarGrupoBatch(empleadoIds, grupoId, modo);
      setResultado(res);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setAplicando(false);
    }
  }

  function cerrar() {
    setResultado(null);
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title="Asignar grupo de horario en bloque" size="md">
      {resultado ? (
        <div className="space-y-4">
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <div className="font-semibold">Asignación completada</div>
            <ul className="mt-2 space-y-0.5">
              <li>Asignados: <b>{resultado.asignados}</b></li>
              <li>Sin cambios (ya tenían grupo): <b>{resultado.ya_tenian}</b></li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={cerrar}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            Vas a aplicar a <b>{empleadoIds.length}</b> empleados (los que están filtrados en la
            lista actual).
          </div>

          <Select
            label="Grupo de horario"
            options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
            placeholder="Selecciona un grupo…"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
          />

          <div className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                checked={modo === 'solo-sin-grupo'}
                onChange={() => setModo('solo-sin-grupo')}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">Solo a los que no tienen grupo asignado</div>
                <div className="text-xs text-slate-500">
                  Saltarse los empleados con un grupo vigente (recomendado).
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                checked={modo === 'reasignar'}
                onChange={() => setModo('reasignar')}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">Reasignar (cerrar actual y asignar este)</div>
                <div className="text-xs text-slate-500">
                  Cierra el grupo vigente con fecha de hoy y asigna el nuevo. Útil para cambio
                  masivo de turno.
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="ghost" onClick={cerrar} disabled={aplicando}>
              Cancelar
            </Button>
            <Button
              onClick={aplicar}
              loading={aplicando}
              disabled={!grupoId || empleadoIds.length === 0}
            >
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
