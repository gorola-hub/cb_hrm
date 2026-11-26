import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LiveRosterTable } from '@/components/admin/LiveRosterTable';
import { AttendanceEditModal } from '@/components/admin/AttendanceEditModal';
import { Navbar } from '@/components/layout/Navbar';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('Phase 8 Admin Attendance Command Center UI Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navbar Admin Attendance Link', () => {
    const baseUser = {
      id: 'usr_1',
      name: 'Test User',
      email: 'user@capitalbridgelogistics.com',
      designation: { name: 'Lead' },
    };

    it('shows Attendance link (/admin/attendance) for ADMIN and hides it for BROKER', () => {
      const { rerender } = render(
        <Navbar
          user={{ ...baseUser, role: { code: 'BROKER', name: 'Broker' } }}
          initialPendingLeaveCount={0}
        />
      );
      expect(screen.queryByRole('link', { name: /^attendance$/i })).toBeNull();

      rerender(
        <Navbar
          user={{ ...baseUser, role: { code: 'ADMIN', name: 'Admin' } }}
          initialPendingLeaveCount={0}
        />
      );
      expect(screen.getByRole('link', { name: /^attendance$/i })).toHaveAttribute(
        'href',
        '/admin/attendance'
      );
    });
  });

  describe('LiveRosterTable', () => {
    const sampleRosterResponse = {
      success: true,
      data: {
        workDate: '2026-11-26',
        isWeekend: false,
        kpis: {
          totalEmployees: 2,
          onShiftCount: 1,
          onBreakCount: 1,
          lateCount: 1,
          onLeaveCount: 0,
          staleCount: 1,
          completedCount: 0,
          offlineCount: 0,
        },
        filtersMeta: {
          shifts: [
            {
              id: 'sh_1900',
              code: 'SHIFT_1900',
              displayName: '19:00 - 03:30 IST',
              startTime: '19:00',
            },
          ],
          roles: [{ code: 'BROKER', name: 'Broker' }],
          designations: [{ code: 'SR_BROKER', name: 'Senior Freight Broker' }],
        },
        roster: [
          {
            user: {
              id: 'usr_1',
              name: 'Denver Broker',
              email: 'broker@capitalbridgelogistics.com',
              empId: 'EMP001',
              alias: 'Denver',
              role: { id: 'r1', code: 'BROKER', name: 'Broker' },
              designation: { id: 'd1', code: 'SR_BROKER', name: 'Senior Freight Broker' },
            },
            assignedShift: {
              id: 'sh_1900',
              code: 'SHIFT_1900',
              displayName: '19:00 - 03:30 IST',
              startTime: '19:00',
            },
            attendance: {
              id: 'att_1',
              workDate: '2026-11-26',
              firstPunchIn: '2026-11-26T14:00:00.000Z',
              lastPunchOut: null,
              grossMinutes: 0,
              totalBreakMinutes: 15,
              netWorkMinutes: 0,
              isLate: true,
              lateMinutes: 30,
              status: 'IN_PROGRESS',
              isRegularized: false,
            },
            breaks: [
              {
                id: 'brk_1',
                breakStart: '2026-11-26T14:30:00.000Z',
                breakEnd: null,
                durationMinutes: 0,
              },
            ],
            activeBreak: {
              id: 'brk_1',
              breakStart: '2026-11-26T14:30:00.000Z',
              breakEnd: null,
              durationMinutes: 0,
            },
            auditLogCount: 0,
            liveState: 'ON_BREAK',
          },
          {
            user: {
              id: 'usr_2',
              name: 'Alex Stale',
              email: 'alex@capitalbridgelogistics.com',
              empId: 'EMP002',
              alias: 'Alex',
              role: { id: 'r1', code: 'BROKER', name: 'Broker' },
              designation: null,
            },
            assignedShift: null,
            attendance: {
              id: 'att_2',
              workDate: '2026-11-26',
              firstPunchIn: '2026-11-25T13:30:00.000Z',
              lastPunchOut: null,
              grossMinutes: 0,
              totalBreakMinutes: 0,
              netWorkMinutes: 0,
              isLate: false,
              lateMinutes: 0,
              status: 'ANOMALY_STALE',
              isRegularized: true,
            },
            breaks: [],
            activeBreak: null,
            auditLogCount: 1,
            liveState: 'ANOMALY_STALE',
          },
        ],
      },
    };

    it('renders KPI cards, roster rows, and expands inline break drawer', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleRosterResponse),
      });

      render(<LiveRosterTable />);

      await waitFor(() => {
        expect(screen.getByText('Denver Broker')).toBeInTheDocument();
      });

      expect(screen.getByText('On Shift Now')).toBeInTheDocument();
      expect(screen.getAllByText('On Break').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Late Today')).toBeInTheDocument();
      expect(screen.getByText('Stale Anomalies')).toBeInTheDocument();
      expect(screen.getByText('Alex Stale')).toBeInTheDocument();
      expect(screen.getByText(/regularized/i)).toBeInTheDocument();

      // Expand inline break drawer for Denver Broker
      fireEvent.click(screen.getByRole('button', { name: /view breaks \(1\)/i }));
      expect(screen.getByText(/break #1/i)).toBeInTheDocument();
    });
  });

  describe('AttendanceEditModal', () => {
    const entry = {
      user: {
        id: 'usr_1',
        name: 'Denver Broker',
        email: 'broker@capitalbridgelogistics.com',
        empId: 'EMP001',
        alias: 'Denver',
        role: { id: 'r1', code: 'BROKER', name: 'Broker' },
        designation: null,
      },
      assignedShift: null,
      attendance: {
        id: 'att_1',
        workDate: '2026-11-24',
        firstPunchIn: '2026-11-24T13:30:00.000Z',
        lastPunchOut: null,
        grossMinutes: 0,
        totalBreakMinutes: 0,
        netWorkMinutes: 0,
        isLate: false,
        lateMinutes: 0,
        status: 'ANOMALY_STALE' as const,
        isRegularized: false,
        shift: null,
      },
      breaks: [],
      activeBreak: null,
      auditLogCount: 0,
      liveState: 'ANOMALY_STALE' as const,
    };

    it('shows error when API rejects empty reason and submits valid regularization', async () => {
      const onClose = vi.fn();
      const onRegularized = vi.fn();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: {
                code: 'ADM_REGULARIZATION_REASON_REQUIRED',
                message:
                  'A mandatory explanation is required to edit or regularize an attendance record.',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, record: { id: 'att_1' } }),
        });

      render(
        <AttendanceEditModal
          entry={entry}
          workDate="2026-11-24"
          onClose={onClose}
          onRegularized={onRegularized}
        />
      );

      // Submit without reason -> displays API error
      fireEvent.click(screen.getByRole('button', { name: /save regularization/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/a mandatory explanation is required to edit or regularize/i)
        ).toBeInTheDocument();
      });

      // Provide reason and submit -> succeeds
      fireEvent.change(screen.getByLabelText(/regularization reason/i), {
        target: { value: 'Home power cut verified with team lead' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save regularization/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/attendance/regularize',
          expect.objectContaining({ method: 'POST' })
        );
        expect(onRegularized).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});

