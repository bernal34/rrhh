// PDF reportes de nómina: prenómina detallada y acumulado por periodo
import { supabase } from './supabase';
import { resolverEmpresaParaPdf, pdfFooterHTML, pdfHeaderHTML } from './pdfHeader';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function abrirVentana(html: string) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para abrir el PDF.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

const baseStyle = `
  @page { size: letter landscape; margin: 12mm }
  body { font-family: Inter, system-ui, sans-serif; color:#0f172a; font-size:10px; margin:0 }
  table { width:100%; border-collapse:collapse }
  th { background:#f1f5f9; text-align:left; padding:5px 7px; font-size:9px; text-transform:uppercase; color:#475569; border-bottom:1px solid #cbd5e1 }
  td { padding:4px 7px; border-bottom:1px solid #e2e8f0 }
  td.r, th.r { text-align:right; font-variant-numeric:tabular-nums }
  .totales { background:#fffbe6; font-weight:bold }
  .estatus { display:inline-block; padding:2px 6px; border-radius:999px; font-size:8px; font-weight:500 }
  .estatus.borrador { background:#f1f5f9; color:#475569 }
  .estatus.en_revision { background:#fef9c3; color:#a16207 }
  .estatus.autorizada { background:#dcfce7; color:#15803d }
  .estatus.cancelada { background:#fee2e2; color:#b91c1c }
  .estatus.convertida { background:#dbeafe; color:#1d4ed8 }
  @media print { .no-print { display:none } }
`;

const printBtn = `<div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">Imprimir / Guardar PDF</button></div><script>setTimeout(()=>window.print(),300)</script>`;

// ============================================================
// PDF: Prenómina detallada (todos los empleados de una prenómina)
// ============================================================
export async function abrirPrenominaPdf(prenominaId: string) {
  const { data: pre } = await supabase
    .from('prenomina')
    .select(
      `*, periodo:periodos_nomina(*),
       sucursal:sucursales(nombre)`,
    )
    .eq('id', prenominaId)
    .single();
  if (!pre) {
    alert('Prenómina no encontrada');
    return;
  }
  const { data: detalles } = await supabase
    .from('nomina_detalle')
    .select(
      'id, dias_trabajados, faltas, retardos, horas_extra, total_percepciones, total_deducciones, neto_pagar, empleado:empleados(nombre, apellido_paterno, apellido_materno, codigo, empresa_id)',
    )
    .eq('prenomina_id', prenominaId)
    .order('neto_pagar', { ascending: false });

  // Resolver empresa: si todos los empleados pertenecen a la misma empresa, úsala
  const empresaIds = new Set(
    (detalles ?? []).map((d: any) => d.empleado?.empresa_id).filter(Boolean),
  );
  const empresaIdUnica = empresaIds.size === 1 ? Array.from(empresaIds)[0] : null;
  const empresa = await resolverEmpresaParaPdf(empresaIdUnica);

  const filas = (detalles ?? [])
    .map((d: any) => {
      const nombre = [d.empleado?.nombre, d.empleado?.apellido_paterno, d.empleado?.apellido_materno]
        .filter(Boolean)
        .join(' ');
      return `<tr>
        <td>${d.empleado?.codigo ?? '—'}</td>
        <td>${nombre}</td>
        <td class="r">${Number(d.dias_trabajados).toFixed(0)}</td>
        <td class="r">${Number(d.faltas).toFixed(0)}</td>
        <td class="r">${d.retardos ?? 0}</td>
        <td class="r">${Number(d.horas_extra).toFixed(1)}</td>
        <td class="r">${fmt.format(d.total_percepciones)}</td>
        <td class="r">${fmt.format(d.total_deducciones)}</td>
        <td class="r"><b>${fmt.format(d.neto_pagar)}</b></td>
      </tr>`;
    })
    .join('');

  const tot = (detalles ?? []).reduce(
    (a: any, d: any) => ({
      p: a.p + Number(d.total_percepciones),
      d: a.d + Number(d.total_deducciones),
      n: a.n + Number(d.neto_pagar),
    }),
    { p: 0, d: 0, n: 0 },
  );

  const periodoTxt = pre.periodo
    ? `${fmtFecha(pre.periodo.fecha_inicio)} → ${fmtFecha(pre.periodo.fecha_fin)} · ${pre.periodo.tipo}`
    : '';
  const subtitle = `${periodoTxt} · ${(detalles ?? []).length} empleados · Estatus ${pre.estatus}${pre.sucursal ? ` · ${pre.sucursal.nombre}` : ''}`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Prenómina ${periodoTxt}</title>
<style>${baseStyle}</style></head><body>
${pdfHeaderHTML(empresa, 'Reporte de Prenómina', subtitle)}
<table>
  <thead><tr>
    <th>Código</th><th>Empleado</th>
    <th class="r">Días</th><th class="r">Faltas</th><th class="r">Retardos</th><th class="r">H.Extra</th>
    <th class="r">Percepciones</th><th class="r">Deducciones</th><th class="r">Neto</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8">Sin registros</td></tr>'}</tbody>
  <tfoot><tr class="totales">
    <td colspan="6" style="text-align:right;padding:8px">TOTALES</td>
    <td class="r" style="padding:8px">${fmt.format(tot.p)}</td>
    <td class="r" style="padding:8px">${fmt.format(tot.d)}</td>
    <td class="r" style="padding:8px">${fmt.format(tot.n)}</td>
  </tr></tfoot>
</table>
${pdfFooterHTML(empresa)}
${printBtn}
</body></html>`;

  abrirVentana(html);
}

// ============================================================
// PDF: Acumulado por periodo (todas las prenóminas + totales)
// ============================================================
export async function abrirAcumuladoPeriodoPdf(periodoId: string) {
  const { data: periodo } = await supabase
    .from('periodos_nomina')
    .select('*')
    .eq('id', periodoId)
    .single();
  if (!periodo) {
    alert('Periodo no encontrado');
    return;
  }
  const { data: prenominas } = await supabase
    .from('prenomina')
    .select('*, sucursal:sucursales(nombre)')
    .eq('periodo_id', periodoId)
    .order('created_at');

  const empresa = await resolverEmpresaParaPdf(null);

  const filas = (prenominas ?? [])
    .map(
      (p: any) => `<tr>
      <td>${p.sucursal?.nombre ?? '—'}</td>
      <td><span class="estatus ${p.estatus}">${p.estatus}</span></td>
      <td class="r">${p.num_empleados}</td>
      <td class="r">${fmt.format(p.total_percepciones)}</td>
      <td class="r">${fmt.format(p.total_deducciones)}</td>
      <td class="r"><b>${fmt.format(p.total_neto)}</b></td>
      <td>${new Date(p.created_at).toLocaleDateString('es-MX')}</td>
    </tr>`,
    )
    .join('');

  // Totales solo de prenóminas no canceladas
  const tot = (prenominas ?? [])
    .filter((p: any) => p.estatus !== 'cancelada')
    .reduce(
      (a: any, p: any) => ({
        emp: a.emp + Number(p.num_empleados),
        p: a.p + Number(p.total_percepciones),
        d: a.d + Number(p.total_deducciones),
        n: a.n + Number(p.total_neto),
      }),
      { emp: 0, p: 0, d: 0, n: 0 },
    );

  const subtitle = `Periodo ${fmtFecha(periodo.fecha_inicio)} → ${fmtFecha(periodo.fecha_fin)} · ${periodo.tipo} · ${(prenominas ?? []).length} prenóminas`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Acumulado periodo</title>
<style>${baseStyle}</style></head><body>
${pdfHeaderHTML(empresa, 'Acumulado por periodo', subtitle)}
<table>
  <thead><tr>
    <th>Sucursal</th><th>Estatus</th><th class="r">Empleados</th>
    <th class="r">Percepciones</th><th class="r">Deducciones</th><th class="r">Neto</th>
    <th>Generado</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Sin prenóminas</td></tr>'}</tbody>
  <tfoot><tr class="totales">
    <td colspan="2" style="text-align:right;padding:8px">TOTALES (excluye canceladas)</td>
    <td class="r" style="padding:8px">${tot.emp}</td>
    <td class="r" style="padding:8px">${fmt.format(tot.p)}</td>
    <td class="r" style="padding:8px">${fmt.format(tot.d)}</td>
    <td class="r" style="padding:8px">${fmt.format(tot.n)}</td>
    <td></td>
  </tr></tfoot>
</table>
${pdfFooterHTML(empresa)}
${printBtn}
</body></html>`;

  abrirVentana(html);
}

// ============================================================
// PDF: Resumen ejecutivo de nómina (todos los periodos del año fiscal)
// ============================================================
export async function abrirResumenAnualPdf(anio: number) {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const { data: periodos } = await supabase
    .from('periodos_nomina')
    .select(
      'id, tipo, fecha_inicio, fecha_fin, fecha_pago, estatus, prenominas:prenomina(num_empleados, total_percepciones, total_deducciones, total_neto, estatus)',
    )
    .gte('fecha_inicio', desde)
    .lte('fecha_fin', hasta)
    .order('fecha_inicio');

  const empresa = await resolverEmpresaParaPdf(null);

  const filas = (periodos ?? [])
    .map((p: any) => {
      const ok = (p.prenominas ?? []).filter(
        (x: any) => x.estatus !== 'cancelada',
      );
      const sumP = ok.reduce((a: number, x: any) => a + Number(x.total_percepciones), 0);
      const sumD = ok.reduce((a: number, x: any) => a + Number(x.total_deducciones), 0);
      const sumN = ok.reduce((a: number, x: any) => a + Number(x.total_neto), 0);
      const sumE = ok.reduce((a: number, x: any) => a + Number(x.num_empleados), 0);
      return `<tr>
        <td>${p.fecha_inicio} → ${p.fecha_fin}</td>
        <td>${p.tipo}</td>
        <td class="r">${ok.length}</td>
        <td class="r">${sumE}</td>
        <td class="r">${fmt.format(sumP)}</td>
        <td class="r">${fmt.format(sumD)}</td>
        <td class="r"><b>${fmt.format(sumN)}</b></td>
      </tr>`;
    })
    .join('');

  const totalAnual = (periodos ?? []).reduce((a: any, p: any) => {
    const ok = (p.prenominas ?? []).filter((x: any) => x.estatus !== 'cancelada');
    return {
      p: a.p + ok.reduce((s: number, x: any) => s + Number(x.total_percepciones), 0),
      d: a.d + ok.reduce((s: number, x: any) => s + Number(x.total_deducciones), 0),
      n: a.n + ok.reduce((s: number, x: any) => s + Number(x.total_neto), 0),
    };
  }, { p: 0, d: 0, n: 0 });

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Resumen anual ${anio}</title>
<style>${baseStyle}</style></head><body>
${pdfHeaderHTML(empresa, `Resumen de nómina ${anio}`, `${(periodos ?? []).length} periodos`)}
<table>
  <thead><tr>
    <th>Periodo</th><th>Tipo</th>
    <th class="r">Prenóminas</th><th class="r">Empleados</th>
    <th class="r">Percepciones</th><th class="r">Deducciones</th><th class="r">Neto</th>
  </tr></thead>
  <tbody>${filas || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Sin datos</td></tr>'}</tbody>
  <tfoot><tr class="totales">
    <td colspan="4" style="text-align:right;padding:8px">TOTAL ANUAL ${anio}</td>
    <td class="r" style="padding:8px">${fmt.format(totalAnual.p)}</td>
    <td class="r" style="padding:8px">${fmt.format(totalAnual.d)}</td>
    <td class="r" style="padding:8px">${fmt.format(totalAnual.n)}</td>
  </tr></tfoot>
</table>
${pdfFooterHTML(empresa)}
${printBtn}
</body></html>`;

  abrirVentana(html);
}
