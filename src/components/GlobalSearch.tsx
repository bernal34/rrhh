import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Resultado = {
  tipo: 'empleado' | 'sucursal' | 'puesto';
  id: string;
  titulo: string;
  subtitulo?: string;
  ruta: string;
};

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!q.trim() || q.length < 2) {
      setResultados([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const term = q.trim();
      const like = `%${term}%`;
      const [emps, sucs, pues] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, apellido_paterno, apellido_materno, codigo, rfc')
          .or(
            `nombre.ilike.${like},apellido_paterno.ilike.${like},apellido_materno.ilike.${like},codigo.ilike.${like},rfc.ilike.${like}`,
          )
          .limit(8),
        supabase.from('sucursales').select('id, nombre').ilike('nombre', like).limit(5),
        supabase.from('puestos').select('id, nombre').ilike('nombre', like).limit(5),
      ]);
      if (!active) return;
      const out: Resultado[] = [];
      (emps.data ?? []).forEach((e: any) =>
        out.push({
          tipo: 'empleado',
          id: e.id,
          titulo: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
          subtitulo: `${e.codigo ?? '—'} · ${e.rfc ?? 'sin RFC'}`,
          ruta: '/empleados',
        }),
      );
      (sucs.data ?? []).forEach((s: any) =>
        out.push({ tipo: 'sucursal', id: s.id, titulo: s.nombre, ruta: '/sucursales' }),
      );
      (pues.data ?? []).forEach((p: any) =>
        out.push({ tipo: 'puesto', id: p.id, titulo: p.nombre, ruta: '/puestos' }),
      );
      setResultados(out);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  function abrir(r: Resultado) {
    navigate(r.ruta);
    setOpen(false);
    setQ('');
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Buscar empleado, sucursal o puesto…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setResultados([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && q.length >= 2 && (
        <div className="absolute z-40 mt-1 max-h-96 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-3 text-sm text-slate-500">Buscando…</div>
          )}
          {!loading && resultados.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">Sin resultados.</div>
          )}
          {!loading &&
            resultados.map((r) => (
              <button
                key={`${r.tipo}-${r.id}`}
                type="button"
                onClick={() => abrir(r)}
                className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                    r.tipo === 'empleado'
                      ? 'bg-brand-100 text-brand-700'
                      : r.tipo === 'sucursal'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {r.tipo}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-800">{r.titulo}</span>
                  {r.subtitulo && (
                    <span className="block text-xs text-slate-500">{r.subtitulo}</span>
                  )}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
