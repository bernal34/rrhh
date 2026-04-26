import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { recalcularAsistencia } from '@/services/asistenciaService';

type Linea = {
  fila: number;
  codigo: string;
  fechaHora: string;
  tipo: 'entrada' | 'salida' | 'desconocido';
  ok: boolean;
  error?: string;
};

type Resumen = { ok: number; error: number; insertadas: number };

const TIPOS_VALIDOS = new Set(['entrada', 'salida', 'desconocido']);

function parseCsv(text: string): string[][] {
  // CSV parser sencillo (no soporta multilínea pero sí comillas)
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ',') {
          out.push(cur);
          cur = '';
        } else if (c === '"' && cur === '') {
          inQ = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  });
}

export default function ImportadorCsv({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Linea[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalcOpts, setRecalcOpts] = useState(true);

  async function analizar(f: File) {
    setFile(f);
    setResumen(null);
    const text = await f.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setPreview([]);
      return;
    }
    // Detecta header
    const header = rows[0].map((h) => h.toLowerCase());
    const start = header.includes('codigo') || header.includes('código') ? 1 : 0;
    const colCodigo = header.findIndex((h) => h === 'codigo' || h === 'código');
    const colFecha = header.findIndex((h) => h.includes('fecha'));
    const colTipo = header.findIndex((h) => h.includes('tipo'));

    // Buscar empleados por código (lookup batch)
    const codigos = new Set<string>();
    for (let i = start; i < rows.length; i++) {
      const codigo = colCodigo >= 0 ? rows[i][colCodigo] : rows[i][0];
      if (codigo) codigos.add(codigo);
    }
    const { data: empleados } = await supabase
      .from('empleados')
      .select('id, codigo')
      .in('codigo', Array.from(codigos));
    const mapById = new Map((empleados ?? []).map((e: any) => [e.codigo, e.id]));

    const lineas: Linea[] = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const codigo = (colCodigo >= 0 ? r[colCodigo] : r[0]) ?? '';
      const fechaStr = (colFecha >= 0 ? r[colFecha] : r[1]) ?? '';
      const tipoStr = ((colTipo >= 0 ? r[colTipo] : r[2]) ?? 'desconocido').toLowerCase();
      const tipo = (TIPOS_VALIDOS.has(tipoStr) ? tipoStr : 'desconocido') as Linea['tipo'];

      let error: string | undefined;
      if (!codigo) error = 'Código faltante';
      else if (!mapById.has(codigo)) error = `Empleado con código "${codigo}" no encontrado`;
      const dt = new Date(fechaStr);
      if (!error && (isNaN(dt.getTime()) || !fechaStr)) error = 'Fecha inválida';
      lineas.push({
        fila: i + 1,
        codigo,
        fechaHora: !isNaN(dt.getTime()) ? dt.toISOString() : fechaStr,
        tipo,
        ok: !error,
        error,
      });
    }
    setPreview(lineas);
  }

  async function importar() {
    if (preview.length === 0) return;
    setLoading(true);
    try {
      const validas = preview.filter((l) => l.ok);
      const codigos = Array.from(new Set(validas.map((l) => l.codigo)));
      const { data: empleados } = await supabase
        .from('empleados')
        .select('id, codigo')
        .in('codigo', codigos);
      const map = new Map((empleados ?? []).map((e: any) => [e.codigo, e.id]));

      const payload = validas.map((l) => ({
        empleado_id: map.get(l.codigo),
        fecha_hora: l.fechaHora,
        tipo: l.tipo,
        dispositivo: 'CSV-Import',
      }));

      // Insertar en batches de 500
      let insertadas = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const batch = payload.slice(i, i + 500);
        const { error } = await supabase.from('checadas').insert(batch);
        if (error) throw error;
        insertadas += batch.length;
      }

      let recalcMsg = '';
      if (recalcOpts && validas.length > 0) {
        const fechas = validas.map((l) => l.fechaHora.slice(0, 10)).sort();
        const desde = fechas[0];
        const hasta = fechas[fechas.length - 1];
        await recalcularAsistencia(desde, hasta);
        recalcMsg = ` · asistencia recalculada del ${desde} al ${hasta}`;
      }

      setResumen({
        ok: validas.length,
        error: preview.length - validas.length,
        insertadas,
      });
      console.log(recalcMsg);
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar checadas desde CSV" size="xl">
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <b>Formato esperado:</b> CSV con columnas <code>codigo</code> (del empleado),
          <code> fecha_hora</code> (ISO o <i>YYYY-MM-DD HH:MM:SS</i>) y <code>tipo</code>
          (<i>entrada / salida / desconocido</i>).
          <br />
          Ejemplo de fila: <code>"EMP001","2026-04-26 08:15:00","entrada"</code>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <FileSpreadsheet className="text-brand-600" size={32} />
          <div className="flex-1">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void analizar(f);
              }}
            />
            {file && (
              <div className="mt-1 text-xs text-slate-500">
                {file.name} — {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
        </div>

        {preview.length > 0 && !resumen && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle2 size={16} /> Listas para importar
                </div>
                <div className="mt-1 text-2xl font-semibold text-green-700 tabular-nums">
                  {preview.filter((l) => l.ok).length}
                </div>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <AlertCircle size={16} /> Con error
                </div>
                <div className="mt-1 text-2xl font-semibold text-red-700 tabular-nums">
                  {preview.filter((l) => !l.ok).length}
                </div>
              </div>
            </div>

            <div className="max-h-60 overflow-auto rounded border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5">Fila</th>
                    <th className="px-2 py-1.5">Código</th>
                    <th className="px-2 py-1.5">Fecha/hora</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 100).map((l) => (
                    <tr key={l.fila} className="border-t border-slate-100">
                      <td className="px-2 py-1 tabular-nums text-slate-500">{l.fila}</td>
                      <td className="px-2 py-1 font-mono">{l.codigo}</td>
                      <td className="px-2 py-1 text-slate-600">{l.fechaHora}</td>
                      <td className="px-2 py-1 capitalize">{l.tipo}</td>
                      <td className="px-2 py-1">
                        {l.ok ? (
                          <span className="text-green-700">OK</span>
                        ) : (
                          <span className="text-red-600">{l.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {preview.length > 100 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-center text-slate-500">
                        … y {preview.length - 100} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recalcOpts}
                onChange={(e) => setRecalcOpts(e.target.checked)}
              />
              Recalcular asistencia del rango después de importar
            </label>
          </>
        )}

        {resumen && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} /> Importación completada
            </div>
            <div className="mt-2">
              {resumen.insertadas} checadas insertadas · {resumen.error} ignoradas por error.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {!resumen && (
            <Button
              onClick={importar}
              loading={loading}
              disabled={preview.filter((l) => l.ok).length === 0}
            >
              <Upload size={16} /> Importar {preview.filter((l) => l.ok).length} checadas
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
