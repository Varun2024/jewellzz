/* Karigar — 4-tab wrapper. Ported to v2 Tabs.
 *
 * Sub-tab files still use v1 CSS; port them before deleting v1.
 */

import { useState } from 'react';
import { KarigarsTab } from './KarigarsTab';
import { IssueTab } from './IssueTab';
import { ReceiveTab } from './ReceiveTab';
import { LedgerTab } from './LedgerTab';
import { Tabs } from '@/components/ui';

type Tab = 'karigars' | 'issue' | 'receive' | 'ledger';

export function KarigarScreen() {
  const [tab, setTab] = useState<Tab>('karigars');
  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'karigars', label: 'Karigars' },
            { value: 'issue',    label: 'Issue' },
            { value: 'receive',  label: 'Receive' },
            { value: 'ledger',   label: 'Ledger' },
          ]}
        />
        {tab === 'karigars' && <KarigarsTab />}
        {tab === 'issue'    && <IssueTab />}
        {tab === 'receive'  && <ReceiveTab />}
        {tab === 'ledger'   && <LedgerTab />}
      </div>
    </div>
  );
}
