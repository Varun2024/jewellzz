/* Jobs — 3-tab wrapper (Approvals / Repairs / Orders). Ported to v2 Tabs.
 *
 * The sub-tab files still use v1 CSS classes — porting them is a follow-up
 * before the v1 deletion pass.
 */

import { useState } from 'react';
import { ApprovalsTab } from './ApprovalsTab';
import { RepairsTab } from './RepairsTab';
import { OrdersTab } from './OrdersTab';
import { Tabs } from '@/components/ui';

type Tab = 'approvals' | 'repairs' | 'orders';

export function JobsScreen() {
  const [tab, setTab] = useState<Tab>('approvals');
  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'approvals', label: 'Approvals' },
            { value: 'repairs',   label: 'Repairs' },
            { value: 'orders',    label: 'Orders' },
          ]}
        />
        {tab === 'approvals' && <ApprovalsTab />}
        {tab === 'repairs'   && <RepairsTab />}
        {tab === 'orders'    && <OrdersTab />}
      </div>
    </div>
  );
}
