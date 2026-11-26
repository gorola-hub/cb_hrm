import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PunchCard } from '@/components/attendance/PunchCard';

describe('PunchCard API Response State Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleRecord = {
    id: 'att_1',
    workDate: '2026-11-26',
    // 16:11:00 UTC === 21:41 IST
    firstPunchIn: '2026-11-26T16:11:00.000Z',
    lastPunchOut: null,
    grossMinutes: 0,
    totalBreakMinutes: 0,
    netWorkMinutes: 0,
    isLate: true,
    lateMinutes: 146,
    status: 'IN_PROGRESS' as const,
    shift: {
      id: 'sh_1900',
      code: 'SHIFT_1900',
      displayName: '19:00 - 03:30 IST',
      startTime: '19:00',
      durationMins: 510,
      graceMinutes: 15,
    },
    breaks: [],
  };

  it('immediately displays punch-in time, workDate, and shift name from POST /api/attendance/punch-in response.record', async () => {
    const onAttendanceUpdated = vi.fn();

    global.fetch = vi
      .fn()
      // Initial /api/attendance/today
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, state: 'IDLE', record: null }),
      })
      // POST /api/attendance/punch-in
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, record: sampleRecord }),
      });

    render(<PunchCard onAttendanceUpdated={onAttendanceUpdated} />);

    const punchInBtn = await screen.findByRole('button', { name: /punch in now/i });
    fireEvent.click(punchInBtn);

    await waitFor(() => {
      expect(screen.getByText('On Shift')).toBeInTheDocument();
      expect(screen.getByText('21:41')).toBeInTheDocument();
      expect(screen.getByText('Work Date: 2026-11-26')).toBeInTheDocument();
      expect(screen.getByText('19:00 - 03:30 IST')).toBeInTheDocument();
    });

    expect(screen.queryByText('--:--')).toBeNull();
    expect(onAttendanceUpdated).toHaveBeenCalledTimes(1);
  });

  it('immediately displays breakStart from breakRecord and final punch-out summary from record', async () => {
    const startedBreak = {
      id: 'brk_1',
      breakStart: '2026-11-26T16:12:00.000Z', // 21:42 IST
      breakEnd: null,
      durationMinutes: 0,
    };

    const sealedRecord = {
      ...sampleRecord,
      lastPunchOut: '2026-11-26T17:50:00.000Z', // 23:20 IST
      grossMinutes: 99,
      totalBreakMinutes: 10,
      netWorkMinutes: 89,
      status: 'A' as const,
    };

    global.fetch = vi
      .fn()
      // Initial /api/attendance/today -> ACTIVE
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, state: 'ACTIVE', record: sampleRecord }),
      })
      // POST /api/attendance/break/start
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, breakRecord: startedBreak }),
      })
      // Background refresh from handleTakeBreak -> /api/attendance/today
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            state: 'ACTIVE',
            record: { ...sampleRecord, breaks: [startedBreak] },
          }),
      })
      // POST /api/attendance/punch-out
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, record: sealedRecord }),
      });

    render(<PunchCard />);

    const takeBreakBtn = await screen.findByRole('button', { name: /take break/i });
    fireEvent.click(takeBreakBtn);

    await waitFor(() => {
      expect(screen.getByText('On Break')).toBeInTheDocument();
      expect(screen.getByText('21:42')).toBeInTheDocument();
    });

    const punchOutBtn = screen.getByRole('button', { name: /punch out/i });
    fireEvent.click(punchOutBtn);

    await waitFor(() => {
      expect(screen.getByText('Shift Sealed')).toBeInTheDocument();
      expect(screen.getByText('21:41')).toBeInTheDocument();
      expect(screen.getByText('23:20')).toBeInTheDocument();
    });
  });
});

