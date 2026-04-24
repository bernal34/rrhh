import { Tabs } from '@/components/ui/Tabs';
import AguinaldoPanel from './AguinaldoPanel';
import PtuPanel from './PtuPanel';
import FiniquitoPanel from './FiniquitoPanel';

export default function CalculadorasPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Calculadoras</h1>
      <Tabs
        tabs={[
          { key: 'aguinaldo', label: 'Aguinaldo', content: <AguinaldoPanel /> },
          { key: 'ptu', label: 'PTU', content: <PtuPanel /> },
          { key: 'finiquito', label: 'Finiquito', content: <FiniquitoPanel /> },
        ]}
      />
    </div>
  );
}
