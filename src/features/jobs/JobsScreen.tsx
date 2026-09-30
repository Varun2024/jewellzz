import { useState } from 'react';
import { ApprovalsTab } from './ApprovalsTab';
import { RepairsTab } from './RepairsTab';
import { OrdersTab } from './OrdersTab';

type Tab = 'approvals' | 'repairs' | 'orders';

export function JobsScreen() {
  const [tab, setTab] = useState<Tab>('approvals');
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="tabs">
        {(['approvals', 'repairs', 'orders'] as Tab[]).map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'repairs' && <RepairsTab />}
      {tab === 'orders' && <OrdersTab />}
    </div>
  );
}
