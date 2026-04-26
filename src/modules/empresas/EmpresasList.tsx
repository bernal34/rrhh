import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, RotateCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth';
import {
  Empresa,
  deleteEmpresa,
  listEmpresas,
  reactivarEmpresa,
  upsertEmpresa,
  uploadLogo,
} from '@/services/empresasService';
import { supabase } from '@/lib/supabase';

export default function EmpresasList() {
  const { puedeEditar } = useAuth();
  const editar = puedeEditar('empresas');
  const [rows, setRows] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [verInactivas, setVerInactivas] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await listEmpresas(!verInactivas));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [verInactivas]);

  async function onBorrar(e: Empresa) {
    if (!confirm(`¿Desactivar "${e.razon_social}"?`)) return;
    await deleteEmpresa(e.id);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Building2 className="text-brand-600" /> Empresas
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={verInactivas}
              onChange={(e) => setVerInactivas(e.target.checked)}
            />
            Mostrar inactivas
          </label>
          {editar && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={16} /> Nueva empresa
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Razón social</th>
              <th className="px-4 py-3">RFC</th>
              <th className="px-4 py-3">Representante</th>
              <th className="px-4 py-3">Reg. patronal</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin empresas registradas.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-slate-100 ${editar ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={() => {
                  if (!editar) return;
                  setEditing(e);
                  setOpen(true);
                }}
              >
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{e.razon_social}</div>
                  {e.nombre_comercial && (
                    <div className="text-xs text-slate-500">{e.nombre_comercial}</div>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.rfc ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">{e.representante_legal ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.registro_patronal_imss ?? '—'}</td>
                <td className="px-4 py-2">
                  {e.activo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Inactiva
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                  {editar &&
                    (e.activo ? (
                      <Button variant="ghost" size="sm" onClick={() => onBorrar(e)}>
                        <Trash2 size={14} />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await reactivarEmpresa(e.id);
                          await load();
                        }}
                      >
                        <RotateCcw size={14} />
                      </Button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EmpresaForm
        open={open}
        onClose={() => setOpen(false)}
        empresa={editing}
        onSaved={() => {
          setOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function EmpresaForm({
  open,
  onClose,
  empresa,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empresa: Empresa | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Empresa>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        empresa ?? {
          razon_social: '',
          activo: true,
        },
      );
      setLogoFile(null);
      setLogoPreview(empresa?.logo_url ?? null);
      setErr(null);
    }
  }, [open, empresa]);

  function onPickLogo(file: File | null) {
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(empresa?.logo_url ?? null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      // Si hay nuevo logo, primero hay que tener id (insert si no existe)
      let id = form.id;
      if (!id) {
        const { data: created, error: cErr } = await supabase
          .from('empresas')
          .insert({
            razon_social: form.razon_social,
            activo: form.activo ?? true,
          })
          .select('id')
          .single();
        if (cErr) throw cErr;
        id = created.id as string;
      }
      let logoUrl = form.logo_url ?? null;
      if (logoFile) {
        logoUrl = await uploadLogo(id!, logoFile);
      }
      await upsertEmpresa({ ...form, id, logo_url: logoUrl });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={empresa ? 'Editar empresa' : 'Nueva empresa'} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">Sin logo</span>
            )}
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700">Logo de la empresa</label>
            <p className="mt-0.5 text-xs text-slate-500">
              PNG/JPG/SVG. Aparece arriba en el portal y en los documentos.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-brand-700"
            />
          </div>
        </div>

        <Input
          label="Razón social *"
          required
          value={form.razon_social ?? ''}
          onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombre comercial"
            value={form.nombre_comercial ?? ''}
            onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
          />
          <Input
            label="RFC"
            value={form.rfc ?? ''}
            onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
          />
        </div>
        <Input
          label="Régimen fiscal (clave SAT)"
          placeholder="ej. 601 General de Ley Personas Morales"
          value={form.regimen_fiscal ?? ''}
          onChange={(e) => setForm({ ...form, regimen_fiscal: e.target.value })}
        />
        <Input
          label="Domicilio fiscal"
          value={form.domicilio_fiscal ?? ''}
          onChange={(e) => setForm({ ...form, domicilio_fiscal: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Ciudad"
            value={form.ciudad ?? ''}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
          />
          <Input
            label="Estado"
            value={form.estado ?? ''}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          />
          <Input
            label="CP"
            value={form.cp ?? ''}
            onChange={(e) => setForm({ ...form, cp: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Teléfono"
            value={form.telefono ?? ''}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <Input
          label="Registro patronal IMSS"
          value={form.registro_patronal_imss ?? ''}
          onChange={(e) => setForm({ ...form, registro_patronal_imss: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Representante legal"
            value={form.representante_legal ?? ''}
            onChange={(e) => setForm({ ...form, representante_legal: e.target.value })}
          />
          <Input
            label="Puesto del representante"
            placeholder="Apoderado legal, Gerente General…"
            value={form.representante_puesto ?? ''}
            onChange={(e) => setForm({ ...form, representante_puesto: e.target.value })}
          />
        </div>
        <Input
          label="Notas"
          value={form.notas ?? ''}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
