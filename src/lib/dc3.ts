// Genera constancia DC-3 (Secretaría del Trabajo) en HTML imprimible.
// Formato oficial simplificado basado en la NOM-030 / acuerdo STPS.

import { supabase } from './supabase';

type Empleado = {
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  curp: string | null;
  codigo: string | null;
  puesto?: { nombre: string } | null;
};

type Capacitacion = {
  nombre: string;
  tema: string | null;
  tipo: string | null;
  fecha: string;
  duracion_horas: number;
  instructor: string | null;
  lugar: string | null;
};

function fmtFecha(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export async function abrirDC3(capacitacionId: string, empleadoId: string) {
  const [capRes, empRes] = await Promise.all([
    supabase.from('capacitaciones').select('*').eq('id', capacitacionId).single(),
    supabase
      .from('empleados')
      .select('nombre, apellido_paterno, apellido_materno, curp, codigo, puesto:puestos(nombre)')
      .eq('id', empleadoId)
      .single(),
  ]);
  if (capRes.error) throw capRes.error;
  if (empRes.error) throw empRes.error;

  const cap = capRes.data as Capacitacion;
  const emp = empRes.data as unknown as Empleado;
  const nombreCompleto = [emp.nombre, emp.apellido_paterno, emp.apellido_materno]
    .filter(Boolean)
    .join(' ');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>DC-3 · ${nombreCompleto}</title>
<style>
  @page { size: letter; margin: 15mm; }
  body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;margin:0}
  .frame{border:2px solid #000;padding:10px}
  .hdr{text-align:center;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:8px}
  .hdr .mini{font-size:9px}
  .hdr h1{font-size:13px;margin:2px 0;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  th,td{border:1px solid #000;padding:4px;vertical-align:top}
  th{background:#e5e5e5;font-size:10px;text-align:left}
  .val{min-height:16px}
  .bloque{margin:8px 0}
  .firma{margin-top:40px;text-align:center;font-size:10px}
  .firma-line{border-top:1px solid #000;width:60%;margin:20px auto 4px}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  @media print { .no-print { display:none } }
</style></head><body>

<div class="frame">
  <div class="hdr">
    <div class="mini">SECRETARÍA DEL TRABAJO Y PREVISIÓN SOCIAL</div>
    <h1>CONSTANCIA DE COMPETENCIAS O DE HABILIDADES LABORALES</h1>
    <div class="mini">Formato DC-3</div>
  </div>

  <div class="bloque">
    <div style="font-weight:bold;font-size:10px;margin-bottom:4px">I. DATOS DEL TRABAJADOR</div>
    <table>
      <tr>
        <th style="width:30%">Nombre completo</th>
        <td class="val">${nombreCompleto}</td>
      </tr>
      <tr>
        <th>CURP</th>
        <td class="val">${emp.curp ?? ''}</td>
      </tr>
      <tr>
        <th>Puesto</th>
        <td class="val">${emp.puesto?.nombre ?? ''}</td>
      </tr>
    </table>
  </div>

  <div class="bloque">
    <div style="font-weight:bold;font-size:10px;margin-bottom:4px">II. DATOS DE LA EMPRESA</div>
    <table>
      <tr>
        <th style="width:30%">Nombre o razón social</th>
        <td class="val">_______________________________________</td>
      </tr>
      <tr>
        <th>RFC</th>
        <td class="val">_______________________________________</td>
      </tr>
      <tr>
        <th>Actividad principal</th>
        <td class="val">_______________________________________</td>
      </tr>
    </table>
  </div>

  <div class="bloque">
    <div style="font-weight:bold;font-size:10px;margin-bottom:4px">III. DATOS DEL CURSO</div>
    <table>
      <tr>
        <th style="width:30%">Nombre del curso</th>
        <td class="val">${cap.nombre}</td>
      </tr>
      <tr>
        <th>Área temática</th>
        <td class="val">${cap.tema ?? cap.tipo ?? ''}</td>
      </tr>
      <tr>
        <th>Duración (horas)</th>
        <td class="val">${cap.duracion_horas}</td>
      </tr>
      <tr>
        <th>Fecha de impartición</th>
        <td class="val">${fmtFecha(cap.fecha)}</td>
      </tr>
      <tr>
        <th>Lugar</th>
        <td class="val">${cap.lugar ?? ''}</td>
      </tr>
    </table>
  </div>

  <div class="bloque">
    <div style="font-weight:bold;font-size:10px;margin-bottom:4px">IV. DATOS DEL AGENTE CAPACITADOR</div>
    <table>
      <tr>
        <th style="width:30%">Nombre</th>
        <td class="val">${cap.instructor ?? ''}</td>
      </tr>
      <tr>
        <th>Registro STPS</th>
        <td class="val">_______________________________________</td>
      </tr>
    </table>
  </div>

  <div class="grid-3" style="margin-top:30px">
    <div class="firma">
      <div class="firma-line"></div>
      <div>Trabajador (nombre y firma)</div>
    </div>
    <div class="firma">
      <div class="firma-line"></div>
      <div>Representante del Patrón</div>
    </div>
    <div class="firma">
      <div class="firma-line"></div>
      <div>Representante de los Trabajadores</div>
    </div>
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">
    Imprimir / Guardar PDF
  </button>
</div>
<script>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Permite ventanas emergentes para generar el DC-3.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
