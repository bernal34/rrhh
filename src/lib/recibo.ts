// Genera un recibo de nómina HTML y lo abre en una ventana con window.print()
// El usuario puede "Guardar como PDF" desde el diálogo de impresión.
// Sin dependencias externas.

import { supabase } from './supabase';
import { getEmpresaById, getEmpresaPrincipal, pdfFooterHTML, pdfHeaderHTML } from './pdfHeader';

type ReciboData = {
  folio: string;
  empresa: string;
  empresa_id: string | null;
  empleado: { nombre: string; codigo: string | null; rfc: string | null; curp: string | null; nss: string | null; puesto: string | null; sucursal: string | null };
  periodo: { tipo: string; fecha_inicio: string; fecha_fin: string; fecha_pago: string | null };
  dias_trabajados: number;
  faltas: number;
  retardos: number;
  horas_extra: number;
  percepciones: Array<{ clave: string; nombre: string; monto: number }>;
  deducciones: Array<{ clave: string; nombre: string; monto: number }>;
  total_percepciones: number;
  total_deducciones: number;
  neto_pagar: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function numeroEnLetras(n: number): string {
  // Simple: solo hasta cientos de miles para recibo
  const enteros = Math.floor(n);
  const centavos = Math.round((n - enteros) * 100);
  return `${enteros.toLocaleString('es-MX')} pesos ${centavos.toString().padStart(2, '0')}/100 M.N.`;
}

export async function obtenerDatosRecibo(nominaDetalleId: string): Promise<ReciboData> {
  const { data: det, error } = await supabase
    .from('nomina_detalle')
    .select(`
      *,
      empleado:empleados(nombre, apellido_paterno, apellido_materno, codigo, rfc, curp, nss, empresa_id,
        puesto:puestos(nombre),
        sucursal:sucursales(nombre)),
      periodo:periodos_nomina(*),
      conceptos:nomina_conceptos_aplicados(monto, es_percepcion, concepto:conceptos_nomina(clave, nombre))
    `)
    .eq('id', nominaDetalleId)
    .single();
  if (error) throw error;

  const emp = det.empleado as Record<string, unknown>;
  const periodo = det.periodo as Record<string, unknown>;
  type ConceptoAplicado = { monto: number; es_percepcion: boolean; concepto: { clave: string; nombre: string } };
  const conceptos = det.conceptos as ConceptoAplicado[];

  const percepciones = conceptos
    .filter((c) => c.es_percepcion)
    .map((c) => ({ clave: c.concepto.clave, nombre: c.concepto.nombre, monto: c.monto }));

  const deducciones = conceptos
    .filter((c) => !c.es_percepcion)
    .map((c) => ({ clave: c.concepto.clave, nombre: c.concepto.nombre, monto: c.monto }));

  // Empresa para membrete: la del empleado o la principal
  const empleadoEmpresaId = (emp.empresa_id as string | null) ?? null;

  return {
    folio: String(det.id).slice(0, 8).toUpperCase(),
    empresa: 'Mi Empresa',
    empresa_id: empleadoEmpresaId,
    empleado: {
      nombre: [emp.nombre, emp.apellido_paterno, emp.apellido_materno].filter(Boolean).join(' '),
      codigo: (emp.codigo as string) ?? null,
      rfc: (emp.rfc as string) ?? null,
      curp: (emp.curp as string) ?? null,
      nss: (emp.nss as string) ?? null,
      puesto: (emp.puesto as { nombre: string } | null)?.nombre ?? null,
      sucursal: (emp.sucursal as { nombre: string } | null)?.nombre ?? null,
    },
    periodo: {
      tipo: periodo.tipo as string,
      fecha_inicio: periodo.fecha_inicio as string,
      fecha_fin: periodo.fecha_fin as string,
      fecha_pago: (periodo.fecha_pago as string) ?? null,
    },
    dias_trabajados: Number(det.dias_trabajados ?? 0),
    faltas: Number(det.faltas ?? 0),
    retardos: Number(det.retardos ?? 0),
    horas_extra: Number(det.horas_extra ?? 0),
    percepciones,
    deducciones,
    total_percepciones: Number(det.total_percepciones ?? 0),
    total_deducciones: Number(det.total_deducciones ?? 0),
    neto_pagar: Number(det.neto_pagar ?? 0),
  };
}

async function htmlRecibo(r: ReciboData): Promise<string> {
  const empresa = (r.empresa_id ? await getEmpresaById(r.empresa_id) : null) ?? (await getEmpresaPrincipal());
  const filasPercep = r.percepciones
    .map((c) => `<tr><td>${c.nombre}</td><td class="r">${fmt(c.monto)}</td></tr>`)
    .join('');
  const filasDeduc = r.deducciones
    .map((c) => `<tr><td>${c.nombre}</td><td class="r">${fmt(c.monto)}</td></tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${r.folio}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:24px;max-width:800px;margin:auto;font-size:12px}
  h1{font-size:16px;margin:0 0 4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .box{border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:10px}
  .title{font-weight:600;color:#4338ca;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  .kv{display:flex;justify-content:space-between;padding:2px 0}
  .kv .k{color:#64748b}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{background:#f8fafc;font-size:10px;text-transform:uppercase;color:#475569}
  .r{text-align:right;font-variant-numeric:tabular-nums}
  .total{background:#eef2ff;border-radius:6px;padding:10px;margin-top:10px;display:flex;justify-content:space-between;align-items:center}
  .total .neto{font-size:18px;font-weight:700;color:#4338ca}
  .firma{margin-top:32px;border-top:1px solid #0f172a;padding-top:6px;text-align:center;font-size:10px;color:#475569}
  @media print { body{padding:0} .no-print{display:none} }
</style></head><body>

${pdfHeaderHTML(empresa, 'Recibo de nómina', `Folio ${r.folio}`)}

<div class="grid" style="margin-top:14px">
  <div class="box">
    <div class="title">Empleado</div>
    <div class="kv"><span class="k">Nombre</span><span>${r.empleado.nombre}</span></div>
    <div class="kv"><span class="k">Código</span><span>${r.empleado.codigo ?? '—'}</span></div>
    <div class="kv"><span class="k">RFC</span><span>${r.empleado.rfc ?? '—'}</span></div>
    <div class="kv"><span class="k">CURP</span><span>${r.empleado.curp ?? '—'}</span></div>
    <div class="kv"><span class="k">NSS</span><span>${r.empleado.nss ?? '—'}</span></div>
    <div class="kv"><span class="k">Puesto</span><span>${r.empleado.puesto ?? '—'}</span></div>
    <div class="kv"><span class="k">Sucursal</span><span>${r.empleado.sucursal ?? '—'}</span></div>
  </div>
  <div class="box">
    <div class="title">Periodo</div>
    <div class="kv"><span class="k">Tipo</span><span>${r.periodo.tipo}</span></div>
    <div class="kv"><span class="k">Del</span><span>${r.periodo.fecha_inicio}</span></div>
    <div class="kv"><span class="k">Al</span><span>${r.periodo.fecha_fin}</span></div>
    <div class="kv"><span class="k">Fecha pago</span><span>${r.periodo.fecha_pago ?? '—'}</span></div>
    <div class="kv"><span class="k">Días trab.</span><span>${r.dias_trabajados}</span></div>
    <div class="kv"><span class="k">Faltas</span><span>${r.faltas}</span></div>
    <div class="kv"><span class="k">Retardos</span><span>${r.retardos}</span></div>
    <div class="kv"><span class="k">Horas extra</span><span>${r.horas_extra}</span></div>
  </div>
</div>

<div class="grid">
  <div class="box">
    <div class="title">Percepciones</div>
    <table><thead><tr><th>Concepto</th><th class="r">Monto</th></tr></thead><tbody>${filasPercep}</tbody>
    <tfoot><tr><th>Total</th><th class="r">${fmt(r.total_percepciones)}</th></tr></tfoot></table>
  </div>
  <div class="box">
    <div class="title">Deducciones</div>
    <table><thead><tr><th>Concepto</th><th class="r">Monto</th></tr></thead><tbody>${filasDeduc || '<tr><td colspan="2" style="color:#94a3b8">Sin deducciones</td></tr>'}</tbody>
    <tfoot><tr><th>Total</th><th class="r">${fmt(r.total_deducciones)}</th></tr></tfoot></table>
  </div>
</div>

<div class="total">
  <div>
    <div style="font-size:10px;text-transform:uppercase;color:#64748b">Neto a pagar</div>
    <div style="color:#475569">${numeroEnLetras(r.neto_pagar)}</div>
  </div>
  <div class="neto">${fmt(r.neto_pagar)}</div>
</div>

<div class="firma">
  Recibí de conformidad<br/>${r.empleado.nombre}
</div>

${pdfFooterHTML(empresa)}

<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">Imprimir / Guardar PDF</button>
</div>

<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;
}

export async function abrirReciboPDF(nominaDetalleId: string) {
  const data = await obtenerDatosRecibo(nominaDetalleId);
  const html = await htmlRecibo(data);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para imprimir el recibo.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
