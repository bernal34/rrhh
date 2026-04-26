import { Calculator } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import PageHeader from '@/components/PageHeader';
import AguinaldoPanel from './AguinaldoPanel';
import PtuPanel from './PtuPanel';
import FiniquitoPanel from './FiniquitoPanel';

export default function CalculadorasPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        modulo="calculadoras"
        icon={Calculator}
        title="Calculadoras"
        subtitle="Aguinaldo, PTU y finiquito según LFT vigente"
      />
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
