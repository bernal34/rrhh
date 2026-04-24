import { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
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

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const estatusColor: Record<string, string> = {
  puntual: 'bg-green-100 text-green-700',
  retardo: 'bg-yellow-100 text-yellow-700',
  falta: 'bg-red-100 text-red-700',
  descanso: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-blue-100 text-blue-700',
};

export default function AsistenciaList() {
  const { sucursales } = useCatalogos();
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [sucursal, setSucursal] = useState('');
  const [estatus, setEstatus] = useState('');
  const [rows, setRows] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      setRows(await getAsistencia({ desde, hasta, sucursal: sucursal || undefined, estatus: estatus || undefined }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRecalcular() {
    setRecalc(true);
    try {
      await recalcularAsistencia(desde, hasta);
      await cargar();
    } finally {
      setRecalc(false);
    }
  }

  const resumen = rows.reduce(
    (a, r) => {
      a[r.estatus] = (a[r.estatus] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Asistencia</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onRecalcular} loading={recalc}>
            <RefreshCw size={16} /> Recalcular rango
          </Button>
          <Button variant="secondary" onClick={() => descargarCsv(rows, `asistencia_${desde}_${hasta}.csv`)}>
            <Download size={16} /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <Select
          label="Sucursal"
          options={sucursales.map((s) => ({ value: s.nombre, label: s.nombre }))}
          placeholder="Todas"
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
        />
        <Select
          label="Estatus"
          options={['puntual', 'retardo', 'falta', 'descanso', 'pendiente'].map((v) => ({
            value: v,
            label: v,
          }))}
          placeholder="Todos"
          value={estatus}
          onChange={(e) => setEstatus(e.target.value)}
        />
        <div className="flex items-end">
          <Button onClick={cargar} loading={loading} className="w-full">
            Consultar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(resumen).map(([k, v]) => (
          <span
            key={k}
            className={`rounded-full px-3 py-1 text-xs font-medium ${estatusColor[k] ?? ''}`}
          >
            {k}: {v}
          </span>
        ))}
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
              <th className="px-4 py-3">Salida</th>
              <th className="px-4 py-3">Retardo</th>
              <th className="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Sin datos. Recalcula el rango para procesar las checadas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.fecha}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{r.empleado}</td>
                <td className="px-4 py-2">{r.sucursal ?? '—'}</td>
                <td className="px-4 py-2">{r.turno ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums">
                  {r.entrada_real ? new Date(r.entrada_real).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.salida_real ? new Date(r.salida_real).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.minutos_retardo ? `${r.minutos_retardo} min` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      estatusColor[r.estatus] ?? ''
                    }`}
                  >
                    {r.estatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
