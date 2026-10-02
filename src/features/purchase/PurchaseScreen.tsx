/* Purchase — two tabs: New (write) and Register (read).
 * The register is a read-only index of posted purchases; see §11 of phases.md.
 */

import { useState } from 'react';
import { Tabs } from '@/components/ui';
import { NewPurchase } from './NewPurchase';
import { PurchaseRegister } from './PurchaseRegister';

type Tab = 'new' | 'register';

export function PurchaseScreen() {
  const [tab, setTab] = useState<Tab>('new');
  return (
    <div
      className="ds-v2"
      style={{
        padding: 'var(--container-pad)',
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'new',      label: 'New' },
            { value: 'register', label: 'Register' },
          ]}
        />
        {tab === 'new'      && <NewPurchase onViewRegister={() => setTab('register')} />}
        {tab === 'register' && <PurchaseRegister />}
      </div>
    </div>
  );
}
