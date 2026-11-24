'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Coffee,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  MonthlyAttendanceResponse,
  MonthDayAttendance,
} from '@/service/attendance.service';
import { DayDetailModal } from './DayDetailModal';

interface AttendanceCalendarProps {
  refreshTrigger?: number;
}

export function AttendanceCalendar({ refreshTrigger }: AttendanceCalendarProps) {
  const [yearMonth, setYearMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<MonthlyAttendanceResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<MonthDayAttendance | null>(null);

  const fetchMonthData = useCallback(async (ym: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/monthly?month=${ym}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCalendarData(json.data);
      }
    } catch {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthData(yearMonth);
  }, [yearMonth, refreshTrigger, fetchMonthData]);

  function handlePrevMonth() {
    const [y, m] = yearMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const nextY = prevDate.getUTCFullYear();
    const nextM = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
    setYearMonth(`${nextY}-${nextM}`);
  }

  function handleNextMonth() {
    const [y, m] = yearMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m, 1));
    const nextY = nextDate.getUTCFullYear();
    const nextM = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
    setYearMonth(`${nextY}-${nextM}`);
  }

  // Display Month Year title
  const monthTitle = (() => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  })();

  // Calculate grid padding for Monday-start calendar
  const paddingDays = (() => {
    if (!calendarData || calendarData.days.length === 0) return 0;
    const firstDay = calendarData.days[0];
    const d = new Date(`${firstDay.date}T12:00:00.000Z`);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    return (dayOfWeek - 1 + 7) % 7;
  })();

  function getBadgeConfig(status: MonthDayAttendance['status']) {
    switch (status) {
      case 'P':
        return { label: 'P', title: 'Present (Full Day)', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'HD':
        return { label: 'HD', title: 'Half Day', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'A':
        return { label: 'A', title: 'Absent', className: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
      case 'LV':
        return { label: 'LV', title: 'Approved Leave', className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      case 'WO':
        return { label: 'WO', title: 'Week Off', className: 'bg-slate-800 text-slate-500 border-slate-700' };
      case 'IN_PROGRESS':
        return { label: 'LIVE', title: 'Shift In Progress', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse' };
      default:
        return null;
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Month Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Monthly Attendance
            </h2>
            <p className="text-xs text-slate-400">
              Shift records and work hours anchored to Indian Standard Time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200 px-3 min-w-[130px] text-center font-mono">
            {monthTitle}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {calendarData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Present (P)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {calendarData.summary.presentCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Half Day (HD)
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {calendarData.summary.halfDayCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Absent (A)
            </div>
            <div className="text-xl font-bold font-mono text-rose-400 mt-1">
              {calendarData.summary.absentCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Leaves (LV)
            </div>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              {calendarData.summary.leaveCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Week Off (WO)
            </div>
            <div className="text-xl font-bold font-mono text-slate-400 mt-1">
              {calendarData.summary.weekOffCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Late Arrivals
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {calendarData.summary.lateCount}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Net Hours
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {(calendarData.summary.totalNetMinutes / 60).toFixed(1)}h
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span>Loading monthly calendar...</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div className="text-slate-500">Sat</div>
            <div className="text-slate-500">Sun</div>
          </div>

          {/* Month day grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank leading padding cells */}
            {Array.from({ length: paddingDays }).map((_, idx) => (
              <div
                key={`pad-${idx}`}
                className="h-20 sm:h-24 bg-slate-950/30 border border-slate-900 rounded-xl opacity-30"
              />
            ))}

            {/* Actual Month Days */}
            {calendarData?.days.map((day) => {
              const badge = getBadgeConfig(day.status);
              const isClickable = !!day.firstPunchIn || day.status === 'P' || day.status === 'HD' || day.status === 'A';

              return (
                <div
                  key={day.date}
                  onClick={() => isClickable && setSelectedDay(day)}
                  className={`h-20 sm:h-24 p-2 rounded-xl border flex flex-col justify-between transition relative ${
                    isClickable
                      ? 'bg-slate-950/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 cursor-pointer'
                      : day.isWeekend
                      ? 'bg-slate-950/40 border-slate-900 text-slate-600'
                      : 'bg-slate-950/60 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-300">
                      {day.dayNumber}
                    </span>
                    {day.isLate && (
                      <span
                        title={`Late by ${day.lateMinutes} mins`}
                        className="w-1.5 h-1.5 rounded-full bg-amber-400"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    {badge && (
                      <div className="flex items-center gap-1">
                        <span
                          title={badge.title}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    )}

                    {day.netWorkMinutes > 0 && (
                      <div className="text-[10px] font-mono text-slate-400 font-medium">
                        {(day.netWorkMinutes / 60).toFixed(1)}h
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

