'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { ShiftMasterItem, ShiftMasterManager } from '@/components/admin/ShiftMasterManager';
import {
  ShiftAssignmentModal,
  ShiftEmployeeOption,
} from '@/components/admin/ShiftAssignmentModal';

interface AssignmentItem {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    empId?: string | null;
    role: { code: string; name: string };
  };
  shift: ShiftMasterItem;
}

export default function AdminShiftsPage() {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftMasterItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [employees, setEmployees] = useState<ShiftEmployeeOption[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/shift-assignments');
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setShifts(json.data.shifts);
        setAssignments(json.data.assignments);
        setEmployees(json.data.employees);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  async function handleDeleteAssignment(id: string) {
    const res = await fetch(`/api/admin/shift-assignments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadSnapshot();
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-6 h-6 text-amber-500 dark:text-[#ffd700]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
              Shift Master & Assignments
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-serif">
            Configure IST night shifts and manage employee shift assignments with effective date history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAssignModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 shadow-sm transition active:scale-95 cursor-pointer font-serif"
        >
          <Plus className="w-4 h-4" />
          <span>Assign Shift</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
          <span>Loading shift catalog and assignments...</span>
        </div>
      ) : (
        <>
          <ShiftMasterManager shifts={shifts} onRefresh={loadSnapshot} />

          {/* Employee Shift Assignment History */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-4">
            <h2 className="text-base font-bold text-foreground font-serif border-b border-border pb-3">
              Employee Shift Assignment History
            </h2>

            {assignments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground font-serif">
                No employee shift assignments configured yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="bg-secondary border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground font-serif">
                          {a.user.name}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30">
                          {a.user.role.code}
                        </span>
                        <span className="text-xs font-bold text-foreground/90">
                          {a.shift.displayName} ({a.shift.code})
                        </span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        Effective: {new Date(a.effectiveFrom).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}{' '}
                        →{' '}
                        {a.effectiveTo
                          ? new Date(a.effectiveTo).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
                          : 'Ongoing'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(a.id)}
                      className="self-start sm:self-center p-2 rounded-lg bg-card border border-border text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      aria-label={`Remove assignment for ${a.user.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ShiftAssignmentModal
        isOpen={assignModalOpen}
        employees={employees}
        shifts={shifts}
        onClose={() => setAssignModalOpen(false)}
        onAssigned={loadSnapshot}
      />
    </div>
  );
}

