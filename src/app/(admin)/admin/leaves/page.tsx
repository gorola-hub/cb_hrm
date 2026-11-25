'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AdminLeaveTable } from '@/components/leaves/AdminLeaveTable';
import { AdminLeaveTypesManager } from '@/components/leaves/AdminLeaveTypesManager';
import { AdminLeaveBalancesManager } from '@/components/leaves/AdminLeaveBalancesManager';

type AdminLeaveTab = 'requests' | 'types' | 'balances';

export default function AdminLeavesPage() {
  const [activeTab, setActiveTab] = useState<AdminLeaveTab>('requests');

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-500 dark:text-[#ffd700]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
              Leave Administration
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-serif">
            Review leave requests, configure leave types, and manage employee quotas & carry-forward.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-secondary p-1 rounded-full border border-border">
          {(
            [
              { id: 'requests', label: 'Leave Requests' },
              { id: 'types', label: 'Leave Types' },
              { id: 'balances', label: 'Employee Balances' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer font-serif ${
                activeTab === t.id
                  ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'requests' && <AdminLeaveTable />}
      {activeTab === 'types' && <AdminLeaveTypesManager />}
      {activeTab === 'balances' && <AdminLeaveBalancesManager />}
    </div>
  );
}
