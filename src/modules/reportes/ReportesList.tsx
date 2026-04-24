import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCatalogos } from '@/hooks/useCatalogos';
import {
  AsistenciaRow,
  descargarCsv,
  getAsistencia,
  recalcularAsistencia,
} from '@/services/asistenciaService';

type Tipo = 'asistencia' | 'retardos' | 'faltas' | 'dia_default';

function hoy() {
  return new Date().toISOString().slice(0, 10);
}
function hace7() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function ReportesList() {
  const { sucursales } = useCatalogos();
  const [tipo, setTipo] = useState<Tipo>('dia_default');
  const [desde, setDesde] = useState(hace7());
  const [hasta, setHasta] = useState(hoy());
  const [sucursal, setSucursal] = useState('');
  const [rows, setRows] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function consultar() {
    setLoading(true);
    try {
      let desde2 = desde;
      let hasta2 = hasta;
      if (tipo === 'dia_default') {
        desde2 = hoy();
        hasta2 = hoy();
      }
      let estatus: string | undefined;
      if (tipo === 'retardos') estatus = 'retardo';
      if (tipo === 'faltas') estatus = 'falta';

      const data = await getAsistencia({
        desde: desde2,
        hasta: hasta2,
        sucursal: sucursal || undefined,
        estatus,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  async function recalc() {
    setLoading(true);
    try {
      await recalcularAsistencia(desde, hasta);
      await consultar();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-6">
        <Select
          label="Reporte"
          options={[
            { value: 'dia_default', label: 'Día de hoy' },
            { value: 'asistencia', label: 'Asistencia (rango)' },
            { value: 'retardos', label: 'Solo retardos' },
            { value: 'faltas', label: 'Solo faltas' },
          ]}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
        />
        <Input
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          disabled={tipo === 'dia_default'}
        />
        <Input
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          disabled={tipo === 'dia_default'}
        />
        <Select
          label="Sucursal"
          options={sucursales.map((s) => ({ value: s.nombre, label: s.nombre }))}
          placeholder="Todas"
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
        />
        <div className="flex items-end">
          <Button onClick={consultar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="secondary" onClick={recalc} loading={loading}>
            <RefreshCw size={14} />
          </Button>
          <Button
            variant="secondary"
            onClick={() => descargarCsv(rows, `reporte_${tipo}_${desde}_${hasta}.csv`)}
            disabled={rows.length === 0}
          >
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      <div className="text-sm text-slate-600">
        {rows.length} resultado(s).
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Turno</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Retardo</th>
              <th className="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.fecha}</td>
                <td className="px-4 py-2 font-medium">{r.empleado}</td>
                <td className="px-4 py-2">{r.sucursal ?? '—'}</td>
                <td className="px-4 py-2">{r.turno ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">
                  {r.entrada_real ? new Date(r.entrada_real).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.minutos_retardo ?? 0} min</td>
                <td className="px-4 py-2">{r.estatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
