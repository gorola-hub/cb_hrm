import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeaveRequestModal } from '@/components/leaves/LeaveRequestModal';
import { AdminLeaveTable } from '@/components/leaves/AdminLeaveTable';
import { Navbar } from '@/components/layout/Navbar';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('Phase 7 Leave Management UI Components', () => {
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

  describe('LeaveRequestModal', () => {
    it('submits valid leave request to POST /api/leaves and calls onSubmitted', async () => {
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

      render(<LeaveRequestModal isOpen={true} onClose={onClose} onSubmitted={onSubmitted} />);

      fireEvent.change(screen.getByLabelText(/leave type/i), { target: { value: 'CASUAL' } });
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-12-07' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-09' } });
      fireEvent.change(screen.getByLabelText(/reason/i), {
        target: { value: 'Family wedding out of town' },
      });

      expect(screen.getByText(/3 working days/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /submit leave request/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/leaves',
          expect.objectContaining({ method: 'POST' })
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
              code: 'LV_OVERLAPPING_REQUEST',
              message: 'You already have an active or pending leave request covering these dates.',
            },
          }),
      });

      render(<LeaveRequestModal isOpen={true} onClose={vi.fn()} onSubmitted={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-12-07' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-08' } });
      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Overlap check' } });

      fireEvent.click(screen.getByRole('button', { name: /submit leave request/i }));

      await waitFor(() => {
        expect(
          screen.getByText(
            /you already have an active or pending leave request covering these dates\./i
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('AdminLeaveTable', () => {
    const sampleRequest = {
      id: 'lv_101',
      leaveType: 'CASUAL' as const,
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

    it('approves a pending leave request via POST /api/admin/leaves/[id]/approve', async () => {
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

    it('opens reject modal and submits explanation to POST /api/admin/leaves/[id]/reject', async () => {
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
          json: () => Promise.resolve({ success: true, leave: { ...sampleRequest, status: 'REJECTED' } }),
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

      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));
      fireEvent.change(screen.getByLabelText(/rejection reason/i), {
        target: { value: 'Peak dispatch shift' },
      });
      fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/leaves/lv_101/reject',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ adminNotes: 'Peak dispatch shift' }),
          })
        );
      });
    });
  });
});
