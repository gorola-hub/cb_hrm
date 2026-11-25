'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
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

  const monthTitle = (() => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  })();

  const firstDayOfWeek = (() => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    const day = d.getUTCDay();
    return day === 0 ? 6 : day - 1; // 0 = Monday, 6 = Sunday
  })();

  const paddingDays = firstDayOfWeek;

  function getBadgeConfig(status: MonthDayAttendance['status']) {
    switch (status) {
      case 'P':
        return {
          label: 'P',
          title: 'Present (Full Day)',
          className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      case 'HD':
        return {
          label: 'HD',
          title: 'Half Day (5h to <8.5h)',
          className: 'bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/30',
        };
      case 'A':
        return {
          label: 'A',
          title: 'Absent (<5h)',
          className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
      case 'LV':
        return {
          label: 'LV',
          title: 'Approved Leave',
          className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        };
      case 'WO':
        return {
          label: 'WO',
          title: 'Week Off (Weekend)',
          className: 'bg-muted text-muted-foreground border border-border',
        };
      case 'IN_PROGRESS':
        return {
          label: 'LIVE',
          title: 'Shift in Progress',
          className: 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 animate-pulse',
        };
      case 'ANOMALY_STALE':
        return {
          label: 'STALE',
          title: 'Stale Shift (>16h without punch-out — needs regularization)',
          className: 'bg-rose-500/20 text-rose-400 border border-rose-500/40',
        };
      default:
        return null;
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6 card-noise text-card-foreground">
      {/* Month Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#ffd700]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-serif">
              Attendance Calendar
            </h2>
            <p className="text-xs text-muted-foreground font-serif">
              Shift records and work hours anchored to Indian Standard Time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-secondary p-1.5 rounded-xl border border-border self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground px-3 min-w-[130px] text-center font-serif">
            {monthTitle}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {calendarData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Present (P)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-1">
              {calendarData.summary.presentCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Half Day (HD)
            </div>
            <div className="text-xl font-bold font-mono text-[#ffd700] mt-1">
              {calendarData.summary.halfDayCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Absent (A)
            </div>
            <div className="text-xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
              {calendarData.summary.absentCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Leaves (LV)
            </div>
            <div className="text-xl font-bold font-mono text-indigo-500 dark:text-indigo-400 mt-1">
              {calendarData.summary.leaveCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Week Off (WO)
            </div>
            <div className="text-xl font-bold font-mono text-muted-foreground mt-1">
              {calendarData.summary.weekOffCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Late Arrivals
            </div>
            <div className="text-xl font-bold font-mono text-[#ffd700] mt-1">
              {calendarData.summary.lateCount}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-serif">
              Total Net Hours
            </div>
            <div className="text-xl font-bold font-mono text-foreground mt-1">
              {(calendarData.summary.totalNetMinutes / 60).toFixed(1)}h
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex items-center gap-3 text-muted-foreground text-sm font-serif">
            <Loader2 className="w-5 h-5 animate-spin text-[#ffd700]" />
            <span>Loading monthly calendar...</span>
          </div>
        </div>
      ) : (
        <div>
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-2 font-serif">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div className="opacity-70">Sat</div>
            <div className="opacity-70">Sun</div>
          </div>

          {/* Month day grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank leading padding cells */}
            {Array.from({ length: paddingDays }).map((_, idx) => (
              <div
                key={`pad-${idx}`}
                className="h-20 sm:h-24 bg-secondary/30 border border-border/40 rounded-xl opacity-30"
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
                      ? 'bg-secondary border-border hover:border-amber-400/60 hover:bg-muted cursor-pointer'
                      : day.isWeekend
                      ? 'bg-secondary/40 border-border/40 text-muted-foreground'
                      : 'bg-secondary/60 border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-foreground">
                      {day.dayNumber}
                    </span>
                    {day.isLate && (
                      <span
                        title={`Late by ${day.lateMinutes} mins`}
                        className="w-1.5 h-1.5 rounded-full bg-[#ffd700]"
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
                      <div className="text-[10px] font-mono text-muted-foreground font-medium">
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
