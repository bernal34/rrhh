import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, User, Network } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';

type Nodo = {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  jefe_id: string | null;
  puesto: string | null;
  sucursal: string | null;
  hijos: Nodo[];
};

export default function OrganigramaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('empleados')
      .select(
        'id, nombre, apellido_paterno, jefe_id, puesto:puestos(nombre), sucursal:sucursales(nombre)',
      )
      .eq('estatus', 'activo')
      .then(({ data }) => {
        setEmpleados(data ?? []);
        setLoading(false);
      });
  }, []);

  const arboles = useMemo(() => construirArbol(empleados), [empleados]);

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Organigrama</h1>
        <p className="text-sm text-slate-500">
          Estructura jerárquica basada en el campo <code>jefe_id</code> de cada empleado.
          Edítalo desde la ficha del empleado.
        </p>
      </div>
      {arboles.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Sin organigrama todavía"
          description="Agrega empleados y asigna su jefe directo desde la ficha (pestaña Datos → Empleo) para construir la jerarquía."
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {arboles.map((n) => (
            <NodoView key={n.id} nodo={n} nivel={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function construirArbol(empleados: any[]): Nodo[] {
  const map = new Map<string, Nodo>();
  empleados.forEach((e) =>
    map.set(e.id, {
      id: e.id,
      nombre: e.nombre,
      apellido_paterno: e.apellido_paterno,
      jefe_id: e.jefe_id,
      puesto: e.puesto?.nombre ?? null,
      sucursal: e.sucursal?.nombre ?? null,
      hijos: [],
    }),
  );
  const raices: Nodo[] = [];
  map.forEach((n) => {
    if (n.jefe_id && map.has(n.jefe_id)) {
      map.get(n.jefe_id)!.hijos.push(n);
    } else {
      raices.push(n);
    }
  });
  return raices.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function NodoView({ nodo, nivel }: { nodo: Nodo; nivel: number }) {
  const [open, setOpen] = useState(nivel < 2);
  const tieneHijos = nodo.hijos.length > 0;

  return (
    <div style={{ marginLeft: nivel * 24 }} className="py-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50">
        <button
          onClick={() => setOpen(!open)}
          className={`text-slate-400 ${tieneHijos ? '' : 'invisible'}`}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <User size={14} className="text-slate-500" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-800">
            {nodo.nombre} {nodo.apellido_paterno ?? ''}
          </span>
          <span className="ml-2 text-xs text-slate-500">
            {nodo.puesto ?? '—'}
            {nodo.sucursal ? ` · ${nodo.sucursal}` : ''}
          </span>
        </div>
        {tieneHijos && (
          <span className="text-xs text-slate-400">
            {nodo.hijos.length} {nodo.hijos.length === 1 ? 'reporta' : 'reportes'}
          </span>
        )}
      </div>
      {open && nodo.hijos.map((h) => <NodoView key={h.id} nodo={h} nivel={nivel + 1} />)}
    </div>
  );
}
