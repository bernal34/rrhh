import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Empresa } from './empresasService';
import { Sucursal, Puesto } from './catalogosService';

// Filas crudas tal como vienen del XLSX de HCC (Información personal).
// Headers exactos: ID, *Nombre, *Apellido, *Departamento,
// Fecha de inicio del periodo efectivo, Fecha final del periodo efectivo,
// Autoservicio, Correo electrónico
export type FilaHCC = {
  ID?: string | number;
  '*Nombre'?: string;
  '*Apellido'?: string;
  '*Departamento'?: string;
  'Fecha de inicio del periodo efectivo'?: string | number | Date;
  'Fecha final del periodo efectivo'?: string | number | Date;
  Autoservicio?: string;
  'Correo electrónico'?: string;
};

export type FilaParsed = {
  rowIndex: number;
  codigo: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  email: string | null;
  fecha_ingreso: string; // YYYY-MM-DD
  empresa_path: string | null; // primer segmento
  sucursal_path: string | null; // segundo segmento
  puesto_path: string | null; // último segmento
  departamento_raw: string | null;
};

export type ResolvedRow = FilaParsed & {
  existing_id: string | null;
  empresa_id: string | null;
  sucursal_id: string | null;
  puesto_id: string | null;
  faltantes: string[]; // descripciones legibles
  accion: 'crear' | 'actualizar' | 'omitir';
  motivo_omitir?: string;
};

export type Plan = {
  rows: ResolvedRow[];
  resumen: {
    total: number;
    a_crear: number;
    a_actualizar: number;
    omitidos: number;
    empresas_faltantes: string[];
    sucursales_faltantes: string[];
    puestos_faltantes: string[];
  };
};

function fechaIso(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

function splitApellido(v: string | undefined): { paterno: string | null; materno: string | null } {
  const s = (v ?? '').trim();
  if (!s) return { paterno: null, materno: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { paterno: parts[0], materno: null };
  // Primer token = paterno, resto = materno (compuesto). Funciona bien para casos típicos
  // tipo "GONZALEZ CHABOLLA" o "DE LA HUERTA" (paterno=DE, materno=LA HUERTA — aceptable
  // sabiendo que en HCC el apellido viene en una sola celda; el usuario puede ajustar manualmente).
  return { paterno: parts[0], materno: parts.slice(1).join(' ') };
}

function splitDepartamento(path: string | undefined): {
  raw: string | null;
  empresa: string | null;
  sucursal: string | null;
  puesto: string | null;
} {
  const raw = (path ?? '').trim();
  if (!raw) return { raw: null, empresa: null, sucursal: null, puesto: null };
  const parts = raw
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { raw, empresa: null, sucursal: null, puesto: null };
  if (parts.length === 1) {
    return { raw, empresa: parts[0], sucursal: null, puesto: null };
  }
  if (parts.length === 2) {
    return { raw, empresa: parts[0], sucursal: null, puesto: parts[1] };
  }
  // 3+ niveles: empresa = primero, sucursal = segundo, puesto = último.
  return {
    raw,
    empresa: parts[0],
    sucursal: parts[1],
    puesto: parts[parts.length - 1],
  };
}

export function parseXlsxHCC(file: File): Promise<FilaParsed[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<FilaHCC>(sh, { defval: '' });

        const out: FilaParsed[] = [];
        json.forEach((r, i) => {
          const id = String(r.ID ?? '').trim();
          const nombre = String(r['*Nombre'] ?? '').trim();
          if (!id || !nombre) return; // saltar filas vacías o sin claves
          const { paterno, materno } = splitApellido(r['*Apellido']);
          const dep = splitDepartamento(r['*Departamento']);
          out.push({
            rowIndex: i + 2, // +2: header en fila 1, primera data en fila 2
            codigo: id,
            nombre,
            apellido_paterno: paterno,
            apellido_materno: materno,
            email: (r['Correo electrónico'] ?? '').toString().trim() || null,
            fecha_ingreso: fechaIso(r['Fecha de inicio del periodo efectivo']),
            empresa_path: dep.empresa,
            sucursal_path: dep.sucursal,
            puesto_path: dep.puesto,
            departamento_raw: dep.raw,
          });
        });
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function buildPlan(
  filas: FilaParsed[],
  empresas: Empresa[],
  sucursales: Sucursal[],
  puestos: Puesto[],
  empleadosByCodigo: Map<string, string>, // codigo -> id
): Plan {
  const empresaByName = new Map<string, string>();
  empresas.forEach((e) => {
    empresaByName.set(norm(e.razon_social), e.id);
    if (e.nombre_comercial) empresaByName.set(norm(e.nombre_comercial), e.id);
  });
  const sucursalByName = new Map(sucursales.map((s) => [norm(s.nombre), s.id]));
  const puestoByName = new Map(puestos.map((p) => [norm(p.nombre), p.id]));

  const empresasFaltantes = new Set<string>();
  const sucursalesFaltantes = new Set<string>();
  const puestosFaltantes = new Set<string>();

  const rows: ResolvedRow[] = filas.map((f) => {
    const faltantes: string[] = [];
    let empresa_id: string | null = null;
    let sucursal_id: string | null = null;
    let puesto_id: string | null = null;

    if (f.empresa_path) {
      empresa_id = empresaByName.get(norm(f.empresa_path)) ?? null;
      if (!empresa_id) {
        faltantes.push(`Empresa: "${f.empresa_path}"`);
        empresasFaltantes.add(f.empresa_path);
      }
    }
    if (f.sucursal_path) {
      sucursal_id = sucursalByName.get(norm(f.sucursal_path)) ?? null;
      if (!sucursal_id) {
        faltantes.push(`Sucursal: "${f.sucursal_path}"`);
        sucursalesFaltantes.add(f.sucursal_path);
      }
    }
    if (f.puesto_path) {
      puesto_id = puestoByName.get(norm(f.puesto_path)) ?? null;
      if (!puesto_id) {
        faltantes.push(`Puesto: "${f.puesto_path}"`);
        puestosFaltantes.add(f.puesto_path);
      }
    }

    const existing_id = empleadosByCodigo.get(f.codigo) ?? null;
    let accion: ResolvedRow['accion'] = existing_id ? 'actualizar' : 'crear';
    let motivo_omitir: string | undefined;
    if (!f.fecha_ingreso) {
      accion = 'omitir';
      motivo_omitir = 'Fecha de inicio inválida';
    }

    return {
      ...f,
      existing_id,
      empresa_id,
      sucursal_id,
      puesto_id,
      faltantes,
      accion,
      motivo_omitir,
    };
  });

  const resumen = {
    total: rows.length,
    a_crear: rows.filter((r) => r.accion === 'crear').length,
    a_actualizar: rows.filter((r) => r.accion === 'actualizar').length,
    omitidos: rows.filter((r) => r.accion === 'omitir').length,
    empresas_faltantes: [...empresasFaltantes].sort(),
    sucursales_faltantes: [...sucursalesFaltantes].sort(),
    puestos_faltantes: [...puestosFaltantes].sort(),
  };

  return { rows, resumen };
}

export async function listEmpleadosCodigos(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('empleados').select('id, codigo');
  if (error) throw error;
  const m = new Map<string, string>();
  (data ?? []).forEach((e: { id: string; codigo: string | null }) => {
    if (e.codigo) m.set(e.codigo.trim(), e.id);
  });
  return m;
}

export async function applyPlan(plan: Plan): Promise<{
  creados: number;
  actualizados: number;
  errores: Array<{ codigo: string; nombre: string; error: string }>;
}> {
  const errores: Array<{ codigo: string; nombre: string; error: string }> = [];
  let creados = 0;
  let actualizados = 0;

  for (const r of plan.rows) {
    if (r.accion === 'omitir') continue;
    const payload: Record<string, unknown> = {
      codigo: r.codigo,
      nombre: r.nombre,
      apellido_paterno: r.apellido_paterno,
      apellido_materno: r.apellido_materno,
      email: r.email,
      fecha_ingreso: r.fecha_ingreso,
      empresa_id: r.empresa_id,
      sucursal_id: r.sucursal_id,
      puesto_id: r.puesto_id,
    };
    if (r.existing_id) {
      payload.id = r.existing_id;
    }
    const { error } = await supabase.from('empleados').upsert(payload, { onConflict: 'codigo' });
    if (error) {
      errores.push({ codigo: r.codigo, nombre: r.nombre, error: error.message });
    } else if (r.accion === 'crear') {
      creados++;
    } else {
      actualizados++;
    }
  }

  return { creados, actualizados, errores };
}
