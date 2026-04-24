import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PrenominaDetalle as PD, getPrenominaDetalle } from '@/services/nominaService';
import { abrirReciboPDF } from '@/lib/recibo';

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

export default function PrenominaDetalle({
  prenominaId,
  onClose,
}: {
  prenominaId: string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PD[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prenominaId) return;
    setLoading(true);
    getPrenominaDetalle(prenominaId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [prenominaId]);

  return (
    <Modal open={!!prenominaId} onClose={onClose} title="Detalle de prenómina" size="xl">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Días</th>
              <th className="px-3 py-2">Faltas</th>
              <th className="px-3 py-2">Retardos</th>
              <th className="px-3 py-2">Percep.</th>
              <th className="px-3 py-2">Deduc.</th>
              <th className="px-3 py-2">Neto</th>
              <th className="px-3 py-2 text-right">Recibo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {r.empleado
                    ? `${r.empleado.nombre} ${r.empleado.apellido_paterno ?? ''}`.trim()
                    : '—'}
                  <div className="text-xs text-slate-500">{r.empleado?.codigo ?? '—'}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.dias_trabajados}</td>
                <td className="px-3 py-2 tabular-nums">{r.faltas}</td>
                <td className="px-3 py-2 tabular-nums">{r.retardos}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(r.total_percepciones)}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(r.total_deducciones)}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{fmt(r.neto_pagar)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => abrirReciboPDF(r.id)}>
                    <FileDown size={14} /> PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
