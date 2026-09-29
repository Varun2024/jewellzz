import { useState } from 'react';
import { KarigarsTab } from './KarigarsTab';
import { IssueTab } from './IssueTab';
import { ReceiveTab } from './ReceiveTab';
import { LedgerTab } from './LedgerTab';

type Tab = 'karigars' | 'issue' | 'receive' | 'ledger';

export function KarigarScreen() {
  const [tab, setTab] = useState<Tab>('karigars');
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="tabs">
        {(['karigars', 'issue', 'receive', 'ledger'] as Tab[]).map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'karigars' && <KarigarsTab />}
      {tab === 'issue' && <IssueTab />}
      {tab === 'receive' && <ReceiveTab />}
      {tab === 'ledger' && <LedgerTab />}
    </div>
  );
}
