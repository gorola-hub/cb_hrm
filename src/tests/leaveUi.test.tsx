import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeaveRequestModal } from '@/components/leaves/LeaveRequestModal';
import { LeaveHistoryList } from '@/components/leaves/LeaveHistoryList';
import { AdminLeaveTable } from '@/components/leaves/AdminLeaveTable';
import { AdminLeaveTypesManager } from '@/components/leaves/AdminLeaveTypesManager';
import { AdminLeaveBalancesManager } from '@/components/leaves/AdminLeaveBalancesManager';
import { Navbar } from '@/components/layout/Navbar';
import LeavesPage from '@/app/(portal)/leaves/page';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('Phase 7.5 Leave Management & Dynamic Config UI Components', () => {
  const sampleLeaveTypes = [
    {
      id: 'lt_paid',
      code: 'PAID',
      name: 'Paid Leave',
      defaultAnnualDays: 12,
      allowCarryForward: false,
      maxCarryForwardDays: 0,
      isPaid: true,
      isActive: true,
    },
    {
      id: 'lt_bereavement',
      code: 'BEREAVEMENT',
      name: 'Bereavement Leave',
      defaultAnnualDays: 5,
      allowCarryForward: false,
      maxCarryForwardDays: 0,
      isPaid: true,
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navbar Admin Leave Notification Badge (FR-LV-002)', () => {
    const baseUser = {
      id: 'usr_1',
      name: 'Test User',
      email: 'user@capitalbridgelogistics.com',
      designation: { name: 'Logistics Specialist' },
    };

    it('shows Leaves link for BROKER and hides Admin Leave Approvals link', () => {
      render(
        <Navbar
          user={{ ...baseUser, role: { code: 'BROKER', name: 'Broker' } }}
          initialPendingLeaveCount={3}
        />
      );
      expect(screen.getByRole('link', { name: /^leaves$/i })).toHaveAttribute('href', '/leaves');
      expect(screen.queryByRole('link', { name: /leave approvals/i })).toBeNull();
    });

    it('shows Admin Leave Approvals link with pending count badge for ADMIN', () => {
      render(
        <Navbar
          user={{ ...baseUser, role: { code: 'ADMIN', name: 'Admin' } }}
          initialPendingLeaveCount={4}
        />
      );
      const adminLink = screen.getByRole('link', { name: /leave approvals/i });
      expect(adminLink).toHaveAttribute('href', '/admin/leaves');
      expect(adminLink.textContent).toContain('4');
    });
  });

  describe('LeaveRequestModal (Dynamic Leave Types)', () => {
    it('renders dynamic leave types and submits leaveTypeId to POST /api/leaves', async () => {
      const onClose = vi.fn();
      const onSubmitted = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            leave: { id: 'lv_1', status: 'PENDING', totalDays: 3 },
          }),
      });

      render(
        <LeaveRequestModal
          isOpen={true}
          onClose={onClose}
          onSubmitted={onSubmitted}
          leaveTypes={sampleLeaveTypes}
        />
      );

      expect(screen.getByRole('option', { name: /bereavement leave/i })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/leave type/i), {
        target: { value: 'lt_bereavement' },
      });
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-12-07' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-09' } });
      fireEvent.change(screen.getByLabelText(/reason/i), {
        target: { value: 'Family bereavement' },
      });

      expect(screen.getByText(/3 working days/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /submit leave request/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/leaves',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('lt_bereavement'),
          })
        );
        expect(onSubmitted).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('displays inline error when API rejects request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: {
              code: 'LV_INSUFFICIENT_BALANCE',
              message: 'Insufficient leave balance for the requested dates.',
            },
          }),
      });

      render(
        <LeaveRequestModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmitted={vi.fn()}
          leaveTypes={sampleLeaveTypes}
        />
      );

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-12-07' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-08' } });
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Check balance' } });

      fireEvent.click(screen.getByRole('button', { name: /submit leave request/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/insufficient leave balance for the requested dates\./i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('LeaveHistoryList (Carry-Forward & Adjustment Display)', () => {
    it('displays entitled, carry-forward, adjusted, used, and remaining days and hides disabled leave types', () => {
      render(
        <LeaveHistoryList
          requests={[]}
          loading={false}
          onRefresh={vi.fn()}
          balances={[
            {
              leaveType: {
                id: 'lt_priv',
                code: 'PRIVILEGED',
                name: 'Privileged Leave',
                defaultAnnualDays: 15,
                allowCarryForward: true,
                maxCarryForwardDays: 10,
                isPaid: true,
                isActive: true,
              },
              year: 2026,
              entitledDays: 15,
              carriedForwardDays: 4,
              adjustedDays: 2,
              totalEntitlement: 21,
              usedDays: 3,
              pendingDays: 1,
              remainingDays: 18,
              availableDays: 17,
              notes: null,
            },
            {
              leaveType: {
                id: 'lt_disabled',
                code: 'OLD_LEAVE',
                name: 'Disabled Leave',
                defaultAnnualDays: 5,
                allowCarryForward: false,
                maxCarryForwardDays: 0,
                isPaid: true,
                isActive: false,
              },
              year: 2026,
              entitledDays: 5,
              carriedForwardDays: 0,
              adjustedDays: 0,
              totalEntitlement: 5,
              usedDays: 0,
              pendingDays: 0,
              remainingDays: 5,
              availableDays: 5,
              notes: null,
            },
          ]}
        />
      );

      expect(screen.getByText('Privileged Leave')).toBeInTheDocument();
      expect(screen.queryByText('Disabled Leave')).toBeNull();
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText(/\+4/)).toBeInTheDocument();
      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it('renders contact-admin banner when hasJoiningDate is false (TS-LV-008)', () => {
      render(
        <LeaveHistoryList
          requests={[]}
          balances={[]}
          hasJoiningDate={false}
          loading={false}
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText(/contact an administrator to add your joining date in crm/i)).toBeInTheDocument();
    });
  });

  describe('AdminLeaveTable', () => {
    const sampleRequest = {
      id: 'lv_101',
      leaveType: { id: 'lt_paid', code: 'PAID', name: 'Paid Leave' },
      startDate: '2026-12-07',
      endDate: '2026-12-09',
      totalDays: 3,
      reason: 'Family event',
      status: 'PENDING' as const,
      adminNotes: null,
      createdAt: '2026-11-25T10:00:00.000Z',
      reviewedAt: null,
      user: {
        id: 'usr_broker',
        name: 'Denver Broker',
        email: 'broker@capitalbridgelogistics.com',
        empId: 'CB-002',
        alias: 'Denver',
        role: { code: 'BROKER', name: 'Broker' },
        designation: { name: 'Freight Broker' },
      },
      reviewer: null,
    };

    it('approves and rejects pending leave requests', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { requests: [sampleRequest], pendingCount: 1 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, leave: { ...sampleRequest, status: 'APPROVED' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { requests: [], pendingCount: 0 },
            }),
        });

      render(<AdminLeaveTable />);

      await waitFor(() => {
        expect(screen.getByText('Denver Broker')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/leaves/lv_101/approve',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('AdminLeaveTypesManager & AdminLeaveBalancesManager', () => {
    it('creates a new leave type in AdminLeaveTypesManager', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, leaveTypes: sampleLeaveTypes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              leaveType: {
                id: 'lt_lwp',
                code: 'LWP',
                name: 'Leave Without Pay',
                defaultAnnualDays: 0,
                allowCarryForward: false,
                maxCarryForwardDays: 0,
                isPaid: false,
                isActive: true,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, leaveTypes: sampleLeaveTypes }),
        });

      render(<AdminLeaveTypesManager />);

      await waitFor(() => {
        expect(screen.getByText('Paid Leave')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/type code/i), { target: { value: 'LWP' } });
      fireEvent.change(screen.getByLabelText(/display name/i), {
        target: { value: 'Leave Without Pay' },
      });
      fireEvent.change(screen.getByLabelText(/default annual days/i), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: /create leave type/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/leave-types',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('edits an existing leave type carry-forward setting via PATCH modal (TS-LV-009)', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, leaveTypes: sampleLeaveTypes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              leaveType: { ...sampleLeaveTypes[0], allowCarryForward: true, maxCarryForwardDays: 5 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, leaveTypes: sampleLeaveTypes }),
        });

      render(<AdminLeaveTypesManager />);

      await waitFor(() => {
        expect(screen.getByText('Paid Leave')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit paid/i }));
      expect(screen.getByText(/edit leave type — paid/i)).toBeInTheDocument();

      const rolloverCheckboxes = screen.getAllByLabelText(/allow year-end carry-forward/i);
      fireEvent.click(rolloverCheckboxes[rolloverCheckboxes.length - 1]);
      const capInputs = screen.getAllByLabelText(/carry-forward cap/i);
      fireEvent.change(capInputs[capInputs.length - 1], { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/leave-types/lt_paid',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"allowCarryForward":true'),
          })
        );
      });
    });

    it('runs carry-forward rollover in AdminLeaveBalancesManager', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                year: 2026,
                leaveTypes: sampleLeaveTypes,
                employees: [
                  {
                    user: {
                      id: 'usr_1',
                      name: 'Denver Broker',
                      email: 'broker@capitalbridgelogistics.com',
                      empId: 'EMP001',
                      role: { code: 'BROKER', name: 'Broker' },
                    },
                    balances: [
                      {
                        leaveType: sampleLeaveTypes[0],
                        year: 2026,
                        entitledDays: 12,
                        carriedForwardDays: 0,
                        adjustedDays: 0,
                        totalEntitlement: 12,
                        usedDays: 2,
                        pendingDays: 0,
                        remainingDays: 10,
                        availableDays: 10,
                        notes: null,
                      },
                    ],
                  },
                ],
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              fromYear: 2026,
              toYear: 2027,
              processedUsers: 1,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { year: 2026, leaveTypes: sampleLeaveTypes, employees: [] },
            }),
        });

      render(<AdminLeaveBalancesManager />);

      await waitFor(() => {
        expect(screen.getByText('Denver Broker')).toBeInTheDocument();
      });

      expect(screen.getByText(/only leave types with/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /run carry-forward rollover/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/leave-balances/carry-forward',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('LeavesPage Live Status Sync', () => {
    it('auto-refreshes leave status on window focus so admin approvals reflect without manual page reload', async () => {
      const paidBalancePending = {
        leaveType: sampleLeaveTypes[0],
        year: 2026,
        entitledDays: 11,
        carriedForwardDays: 0,
        adjustedDays: 0,
        totalEntitlement: 11,
        usedDays: 0,
        pendingDays: 2,
        remainingDays: 11,
        availableDays: 9,
        notes: null,
      };
      const pendingRequest = {
        id: 'lv_sync_1',
        leaveType: { id: 'lt_paid', code: 'PAID', name: 'Paid Leave', isPaid: true },
        startDate: '2026-12-03',
        endDate: '2026-12-04',
        totalDays: 2,
        reason: 'Test',
        status: 'PENDING' as const,
        adminNotes: null,
        createdAt: '2026-11-27T20:00:00.000Z',
        reviewedAt: null,
        reviewer: null,
      };

      global.fetch = vi.fn((url: RequestInfo | URL) => {
        const str = String(url);
        if (str === '/api/leave-types') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, leaveTypes: sampleLeaveTypes }),
          } as Response);
        }
        // First call -> PENDING; subsequent focus refresh -> APPROVED
        const callCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
          (args) => String(args[0]) === '/api/leaves'
        ).length;

        if (callCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  year: 2026,
                  hasJoiningDate: true,
                  requests: [pendingRequest],
                  balances: [paidBalancePending],
                },
              }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                year: 2026,
                hasJoiningDate: true,
                requests: [{ ...pendingRequest, status: 'APPROVED' }],
                balances: [
                  {
                    ...paidBalancePending,
                    usedDays: 2,
                    pendingDays: 0,
                    remainingDays: 9,
                    availableDays: 9,
                  },
                ],
              },
            }),
        } as Response);
      });

      render(<LeavesPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });

      // Simulate user returning to the browser tab after Admin approved in another window
      fireEvent.focus(window);

      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
    });
  });
});
