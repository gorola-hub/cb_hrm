'use client';

import { X, Clock, Coffee, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { MonthDayAttendance } from '@/service/attendance.service';

interface DayDetailModalProps {
  day: MonthDayAttendance | null;
  onClose: () => void;
}

export function DayDetailModal({ day, onClose }: DayDetailModalProps) {
  if (!day) return null;

  function formatISTTime(utcDate?: Date | string | null) {
    if (!utcDate) return '--:--';
    return new Date(utcDate).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusLabel(status: MonthDayAttendance['status']) {
    switch (status) {
      case 'P':
        return { label: 'Present (Full Day)', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'HD':
        return { label: 'Half Day', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'A':
        return { label: 'Absent', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
      case 'LV':
        return { label: 'Approved Leave', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      case 'WO':
        return { label: 'Week Off', color: 'bg-slate-700/40 text-slate-400 border-slate-600/30' };
      case 'IN_PROGRESS':
        return { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      default:
        return { label: 'Unscheduled', color: 'bg-slate-800 text-slate-500 border-slate-700' };
    }
  }

  const statusBadge = getStatusLabel(day.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Attendance Details
              </h3>
              <p className="text-xs text-slate-400">
                {day.dayOfWeek}, {day.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.color}`}
          >
            {statusBadge.label}
          </span>
          {day.isLate && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Late Arrival ({day.lateMinutes} mins)
            </span>
          )}
          {day.isRegularized && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Admin Regularized
            </span>
          )}
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400">First Punch-In (IST)</div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {formatISTTime(day.firstPunchIn)}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400">Last Punch-Out (IST)</div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {formatISTTime(day.lastPunchOut)}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400">Gross Duration</div>
            <div className="text-sm font-bold font-mono text-slate-300 mt-1">
              {(day.grossMinutes / 60).toFixed(1)} hrs ({day.grossMinutes} mins)
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400">Total Break Time</div>
            <div className="text-sm font-bold font-mono text-slate-300 mt-1">
              {day.totalBreakMinutes} mins
            </div>
          </div>

          <div className="col-span-2 bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-xs text-slate-400">Net Working Time</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-1">
              {(day.netWorkMinutes / 60).toFixed(1)} hrs ({day.netWorkMinutes} mins)
            </div>
          </div>
        </div>

        {/* Itemized Break Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span>Itemized Break Timeline</span>
          </h4>

          {day.breaks && day.breaks.length > 0 ? (
            <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/60 bg-slate-950 text-xs">
              {day.breaks.map((b, idx) => (
                <div key={b.id} className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="text-slate-300 font-mono">
                      {formatISTTime(b.breakStart)} → {formatISTTime(b.breakEnd)}
                    </span>
                  </div>
                  <span className="font-semibold text-amber-400">
                    {b.durationMinutes} mins
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
              No breaks recorded for this shift.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

