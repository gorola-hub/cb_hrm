'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  FileEdit,
  History,
  Loader2,
  Search,
  ShieldAlert,
  UserCheck,
  UserMinus,
  X,
} from 'lucide-react';
import { AttendanceEditModal, RosterEntryItem } from './AttendanceEditModal';

interface RosterKpis {
  totalEmployees: number;
  onShiftCount: number;
  onBreakCount: number;
  lateCount: number;
  onLeaveCount: number;
  staleCount: number;
  completedCount: number;
  offlineCount: number;
}

interface FiltersMeta {
  shifts: Array<{ id: string; code: string; displayName: string; startTime: string }>;
  roles: Array<{ code: string; name: string }>;
  designations: Array<{ code: string; name: string }>;
}

interface AuditLogEntry {
  id: string;
  reason: string;
  createdAt: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  admin: { id: string; name: string; email: string };
}

function getDefaultISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatISTTime(value?: string | Date | null): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLiveBadge(entry: RosterEntryItem) {
  switch (entry.liveState) {
    case 'WORKING':
      return {
        label: 'On Shift',
        className: 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30',
      };
    case 'ON_BREAK':
      return {
        label: 'On Break',
        className: 'bg-amber-400/20 text-amber-500 dark:text-[#ffd700] border-amber-400/30',
      };
    case 'ANOMALY_STALE':
      return {
        label: 'Stale (>16h)',
        className: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse',
      };
    case 'ON_LEAVE':
      return {
        label: 'On Leave (LV)',
        className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      };
    case 'WEEK_OFF':
      return {
        label: 'Week Off (WO)',
        className: 'bg-muted text-muted-foreground border-border',
      };
    case 'COMPLETED': {
      const st = entry.attendance?.status;
      if (st === 'P') {
        return {
          label: 'Present (P)',
          className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      }
      if (st === 'HD') {
        return {
          label: 'Half Day (HD)',
          className: 'bg-amber-400/20 text-amber-500 dark:text-[#ffd700] border-amber-400/30',
        };
      }
      return {
        label: 'Absent (A)',
        className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      };
    }
    default:
      return {
        label: 'Offline',
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

export function LiveRosterTable() {
  const [workDate, setWorkDate] = useState(getDefaultISTDate);
  const [shiftId, setShiftId] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<RosterKpis | null>(null);
  const [roster, setRoster] = useState<RosterEntryItem[]>([]);
  const [filtersMeta, setFiltersMeta] = useState<FiltersMeta>({
    shifts: [],
    roles: [],
    designations: [],
  });

  const [expandedBreaks, setExpandedBreaks] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<RosterEntryItem | null>(null);
  const [auditModal, setAuditModal] = useState<{
    employeeName: string;
    logs: AuditLogEntry[];
    loading: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ date: workDate });
      if (shiftId) params.set('shiftId', shiftId);
      if (roleCode) params.set('roleCode', roleCode);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/attendance?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setKpis(json.data.kpis);
        setRoster(json.data.roster);
        if (json.data.filtersMeta) {
          setFiltersMeta(json.data.filtersMeta);
        }
      } else {
        setError(json.error?.message || 'Failed to load company roster.');
      }
    } catch {
      setError('Network error loading company roster.');
    } finally {
      setLoading(false);
    }
  }, [workDate, shiftId, roleCode, statusFilter, search]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  async function handleOpenAuditLogs(entry: RosterEntryItem) {
    if (!entry.attendance?.id) return;
    setAuditModal({ employeeName: entry.user.name, logs: [], loading: true });
    try {
      const res = await fetch(`/api/admin/attendance/${entry.attendance.id}/audit-logs`);
      const json = await res.json();
      setAuditModal({
        employeeName: entry.user.name,
        logs: res.ok && json.success ? json.logs : [],
        loading: false,
      });
    } catch {
      setAuditModal({ employeeName: entry.user.name, logs: [], loading: false });
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'On Shift Now', value: kpis.onShiftCount, icon: Activity, tone: 'text-blue-400' },
            { label: 'On Break', value: kpis.onBreakCount, icon: Coffee, tone: 'text-[#ffd700]' },
            { label: 'Late Today', value: kpis.lateCount, icon: Clock, tone: 'text-amber-400' },
            { label: 'On Leave', value: kpis.onLeaveCount, icon: UserCheck, tone: 'text-indigo-400' },
            {
              label: 'Stale Anomalies',
              value: kpis.staleCount,
              icon: AlertTriangle,
              tone: 'text-rose-400',
            },
            { label: 'Offline', value: kpis.offlineCount, icon: UserMinus, tone: 'text-muted-foreground' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-card border border-border rounded-2xl p-4 shadow-lg card-noise space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-serif">
                    {card.label}
                  </span>
                  <Icon className={`w-4 h-4 ${card.tone}`} />
                </div>
                <div className="text-2xl font-bold font-mono text-foreground">{card.value}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bar & Roster Container */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="roster-date"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Work Date (IST)
            </label>
            <input
              id="roster-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-mono text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="roster-shift"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Shift
            </label>
            <select
              id="roster-shift"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-xs text-foreground"
            >
              <option value="">All Shifts</option>
              {filtersMeta.shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="roster-role"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Department / Role
            </label>
            <select
              id="roster-role"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-xs text-foreground"
            >
              <option value="">All Roles</option>
              {filtersMeta.roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="roster-search"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Search Employee
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <input
                id="roster-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, or EMP ID..."
                className="w-full rounded-xl bg-secondary border border-border pl-8 pr-3 py-2 text-xs text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'WORKING', label: 'Working' },
              { id: 'ON_BREAK', label: 'On Break' },
              { id: 'ANOMALY_STALE', label: 'Stale' },
              { id: 'LATE', label: 'Late' },
              { id: 'ON_LEAVE', label: 'On Leave' },
              { id: 'OFFLINE', label: 'Offline' },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer font-serif ${
                statusFilter === pill.id
                  ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
            <span>Loading live company roster...</span>
          </div>
        ) : roster.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground font-serif">
            No employees match the selected filters for {workDate}.
          </div>
        ) : (
          <div className="space-y-3">
            {roster.map((entry) => {
              const badge = getLiveBadge(entry);
              const isExpanded = Boolean(expandedBreaks[entry.user.id]);
              return (
                <div
                  key={entry.user.id}
                  className={`bg-secondary border rounded-xl p-4 space-y-3 ${
                    entry.liveState === 'ANOMALY_STALE'
                      ? 'border-rose-500/50'
                      : 'border-border'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground font-serif">
                          {entry.user.name}
                        </span>
                        {entry.user.empId && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                            {entry.user.empId}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30">
                          {entry.user.role.code}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {entry.attendance?.isLate && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Late +{entry.attendance.lateMinutes}m
                          </span>
                        )}
                        {entry.attendance?.isRegularized && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            Regularized
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                        <span>
                          Shift: {entry.assignedShift ? entry.assignedShift.displayName : 'Unassigned'}
                        </span>
                        <span>In: {formatISTTime(entry.attendance?.firstPunchIn)}</span>
                        <span>Out: {formatISTTime(entry.attendance?.lastPunchOut)}</span>
                        <span>Break: {entry.attendance?.totalBreakMinutes ?? 0}m</span>
                        <span>Net: {entry.attendance?.netWorkMinutes ?? 0}m</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {entry.breaks.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBreaks((prev) => ({
                              ...prev,
                              [entry.user.id]: !prev[entry.user.id],
                            }))
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground hover:border-[#ffd700]/40 cursor-pointer"
                        >
                          <Coffee className="w-3.5 h-3.5 text-[#ffd700]" />
                          <span>View Breaks ({entry.breaks.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {entry.auditLogCount > 0 && entry.attendance?.id && (
                        <button
                          type="button"
                          onClick={() => handleOpenAuditLogs(entry)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-indigo-400 hover:border-indigo-400/50 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Audit ({entry.auditLogCount})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingEntry(entry)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer font-serif"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>Regularize</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Break Drawer */}
                  {isExpanded && entry.breaks.length > 0 && (
                    <div className="border-t border-border pt-3 space-y-1.5">
                      {entry.breaks.map((brk, idx) => (
                        <div
                          key={brk.id}
                          className="flex items-center justify-between text-xs font-mono bg-card border border-border rounded-lg px-3 py-2"
                        >
                          <span className="font-semibold text-foreground">Break #{idx + 1}</span>
                          <span className="text-muted-foreground">
                            {formatISTTime(brk.breakStart)} →{' '}
                            {brk.breakEnd ? formatISTTime(brk.breakEnd) : 'Active'}
                          </span>
                          <span className="text-[#ffd700]">
                            {brk.breakEnd ? `${brk.durationMinutes}m` : 'In Progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Regularization Modal */}
      {editingEntry && (
        <AttendanceEditModal
          entry={editingEntry}
          workDate={workDate}
          onClose={() => setEditingEntry(null)}
          onRegularized={fetchRoster}
        />
      )}

      {/* Immutable Audit Trail Modal */}
      {auditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#ffd700]" />
                <h3 className="text-base font-bold text-foreground font-serif">
                  Immutable Audit Trail — {auditModal.employeeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close Audit Logs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {auditModal.loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#ffd700]" />
              </div>
            ) : auditModal.logs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No audit entries found.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditModal.logs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-secondary border border-border rounded-xl p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{log.admin.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-foreground/90">
                      <strong className="text-[#ffd700]">Reason:</strong> {log.reason}
                    </p>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      Status: {String(log.previousValues?.status ?? 'NONE')} →{' '}
                      {String(log.newValues?.status ?? '')} | Net:{' '}
                      {String(log.previousValues?.netWorkMinutes ?? 0)}m →{' '}
                      {String(log.newValues?.netWorkMinutes ?? 0)}m
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

