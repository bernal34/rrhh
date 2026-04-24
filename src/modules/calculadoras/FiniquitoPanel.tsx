import { useEffect, useMemo, useState } from 'react';
import { Calculator, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { supabase } from '@/lib/supabase';
import { Empleado, listEmpleados } from '@/services/empleadosService';
import { abrirFiniquitoPDF } from '@/lib/finiquitoPdf';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

type Causa = 'renuncia' | 'despido_justificado' | 'despido_injustificado' | 'mutuo_acuerdo';

const causaOpts: Array<{ value: Causa; label: string }> = [
  { value: 'renuncia', label: 'Renuncia voluntaria' },
  { value: 'despido_justificado', label: 'Rescisión justificada (LFT 47)' },
  { value: 'despido_injustificado', label: 'Despido injustificado' },
  { value: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
];

function diferenciaDias(desde: string, hasta: string): number {
  return Math.floor(
    (new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function diasVacacionesLft(antiguedadAnios: number): number {
  if (antiguedadAnios < 1) return 0;
  if (antiguedadAnios <= 5) return 12 + (antiguedadAnios - 1) * 2;
  if (antiguedadAnios <= 10) return 22;
  if (antiguedadAnios <= 15) return 24;
  if (antiguedadAnios <= 20) return 26;
  if (antiguedadAnios <= 25) return 28;
  if (antiguedadAnios <= 30) return 30;
  return 32;
}

export default function FiniquitoPanel() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoId, setEmpleadoId] = useState('');
  const [fechaBaja, setFechaBaja] = useState(new Date().toISOString().slice(0, 10));
  const [causa, setCausa] = useState<Causa>('renuncia');
  const [sueldo, setSueldo] = useState(0);
  const [diasVacPendientes, setDiasVacPendientes] = useState(0);
  const [diasPendientes, setDiasPendientes] = useState(0);

  useEffect(() => {
    listEmpleados().then(setEmpleados);
  }, []);

  useEffect(() => {
    if (!empleadoId) return;
    supabase
      .from('empleado_sueldo')
      .select('sueldo_mensual')
      .eq('empleado_id', empleadoId)
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setSueldo(data?.sueldo_mensual ?? 0));
  }, [empleadoId]);

  const emp = empleados.find((e) => e.id === empleadoId);

  const calc = useMemo(() => {
    if (!emp) return null;
    const ingreso = emp.fecha_ingreso;
    const dias = diferenciaDias(ingreso, fechaBaja);
    const anios = Math.floor(dias / 365);
    const salarioDiario = sueldo / 30;
    const salarioDiarioIntegrado = salarioDiario * 1.0452; // factor estándar (vacaciones + aguinaldo + 25% prima vac.)

    // Conceptos comunes
    const aguinaldoProp =
      ((diferenciaDias(`${new Date().getFullYear()}-01-01`, fechaBaja) + 1) * 15 * salarioDiario) / 365;
    const diasVacAnio = diasVacacionesLft(anios + 1);
    const vacacionesProp =
      diasVacAnio * salarioDiario * (((diferenciaDias(ingreso, fechaBaja) % 365) + 1) / 365);
    const primaVacacional = (vacacionesProp + diasVacPendientes * salarioDiario) * 0.25;
    const sueldoPendiente = diasPendientes * salarioDiario;
    const vacPendientesMonto = diasVacPendientes * salarioDiario;

    // Indemnizaciones (solo despido injustificado)
    let indemn3meses = 0;
    let prima20 = 0;
    if (causa === 'despido_injustificado') {
      indemn3meses = 90 * salarioDiarioIntegrado;
      prima20 = anios * 20 * salarioDiarioIntegrado;
    }
    const primaAntiguedad = anios >= 15 || causa === 'despido_injustificado' ? anios * 12 * salarioDiarioIntegrado : 0;

    const totalFiniquito = aguinaldoProp + vacacionesProp + primaVacacional + sueldoPendiente + vacPendientesMonto;
    const totalLiquidacion = indemn3meses + prima20 + primaAntiguedad;
    const granTotal = totalFiniquito + totalLiquidacion;

    return {
      anios,
      dias,
      salarioDiario,
      salarioDiarioIntegrado,
      aguinaldoProp,
      vacacionesProp,
      primaVacacional,
      sueldoPendiente,
      vacPendientesMonto,
      indemn3meses,
      prima20,
      primaAntiguedad,
      totalFiniquito,
      totalLiquidacion,
      granTotal,
    };
  }, [emp, fechaBaja, causa, sueldo, diasVacPendientes, diasPendientes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚠️ Cálculo <b>orientativo</b>. Verifica con tu asesor legal antes de pagar.
        Usa el factor de salario diario integrado <b>1.0452</b> (vacaciones + aguinaldo + 25% prima vac.). Ajusta si tu caso requiere otro factor.
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
        <Select
          label="Empleado *"
          required
          placeholder="Selecciona empleado"
          options={empleados.map((e) => ({
            value: e.id,
            label: `${e.nombre} ${e.apellido_paterno ?? ''}`.trim(),
          }))}
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
        />
        <Select
          label="Causa de la baja *"
          options={causaOpts}
          value={causa}
          onChange={(e) => setCausa(e.target.value as Causa)}
        />
        <Input
          label="Fecha de baja"
          type="date"
          value={fechaBaja}
          onChange={(e) => setFechaBaja(e.target.value)}
        />
        <Input
          label="Sueldo mensual (MXN)"
          type="number"
          step="0.01"
          value={sueldo}
          onChange={(e) => setSueldo(Number(e.target.value) || 0)}
        />
        <Input
          label="Días de sueldo pendientes"
          type="number"
          min={0}
          value={diasPendientes}
          onChange={(e) => setDiasPendientes(Number(e.target.value) || 0)}
        />
        <Input
          label="Días de vacaciones pendientes"
          type="number"
          min={0}
          value={diasVacPendientes}
          onChange={(e) => setDiasVacPendientes(Number(e.target.value) || 0)}
        />
      </div>

      {calc && emp && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Calculator size={16} /> Finiquito (siempre se paga)
            </h3>
            <Linea label="Aguinaldo proporcional" valor={calc.aguinaldoProp} />
            <Linea label="Vacaciones proporcionales" valor={calc.vacacionesProp} />
            <Linea label="Prima vacacional 25%" valor={calc.primaVacacional} />
            <Linea label="Sueldo pendiente" valor={calc.sueldoPendiente} />
            <Linea label="Vacaciones pendientes" valor={calc.vacPendientesMonto} />
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
              <span>Subtotal finiquito</span>
              <span className="tabular-nums">{fmt.format(calc.totalFiniquito)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Calculator size={16} /> Liquidación (depende de la causa)
            </h3>
            <Linea label="Indemnización 3 meses (90 días SDI)" valor={calc.indemn3meses} />
            <Linea label="20 días por año de servicio (SDI)" valor={calc.prima20} />
            <Linea label="Prima de antigüedad (12 días/año, máx. 2 SMG)" valor={calc.primaAntiguedad} />
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
              <span>Subtotal liquidación</span>
              <span className="tabular-nums">{fmt.format(calc.totalLiquidacion)}</span>
            </div>
          </div>

          <div className="rounded-lg border-2 border-brand-300 bg-brand-50 p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-brand-700">Total a pagar</div>
                <div className="text-xs text-slate-600">
                  Antigüedad: {calc.anios} años · Salario diario: {fmt.format(calc.salarioDiario)} ·
                  SDI: {fmt.format(calc.salarioDiarioIntegrado)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-brand-700 tabular-nums">
                  {fmt.format(calc.granTotal)}
                </div>
                <Button
                  onClick={() =>
                    abrirFiniquitoPDF(emp.id, {
                      causa,
                      fechaBaja,
                      sueldoMensual: sueldo,
                      salarioDiario: calc.salarioDiario,
                      salarioDiarioIntegrado: calc.salarioDiarioIntegrado,
                      diasAntiguedad: calc.dias,
                      aniosAntiguedad: calc.anios,
                      aguinaldoProp: calc.aguinaldoProp,
                      vacacionesProp: calc.vacacionesProp,
                      primaVacacional: calc.primaVacacional,
                      sueldoPendiente: calc.sueldoPendiente,
                      vacPendientesMonto: calc.vacPendientesMonto,
                      indemn3meses: calc.indemn3meses,
                      prima20: calc.prima20,
                      primaAntiguedad: calc.primaAntiguedad,
                      totalFiniquito: calc.totalFiniquito,
                      totalLiquidacion: calc.totalLiquidacion,
                      granTotal: calc.granTotal,
                    })
                  }
                >
                  <FileSignature size={16} /> Generar PDF firma
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Linea({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums text-slate-800">{fmt.format(valor)}</span>
    </div>
  );
}
