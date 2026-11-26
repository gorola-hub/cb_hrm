import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShiftMasterManager } from '@/components/admin/ShiftMasterManager';
import { ShiftAssignmentModal } from '@/components/admin/ShiftAssignmentModal';
import { Navbar } from '@/components/layout/Navbar';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('Phase 9: Shift Master & Assignment UI Components', () => {
  const sampleShifts = [
    {
      id: 'sh_1900',
      code: 'SHIFT_1900',
      displayName: '19:00 - 03:30 IST',
      startTime: '19:00',
      durationMins: 510,
      graceMinutes: 15,
      isActive: true,
      _count: { employeeShifts: 4 },
    },
  ];

  const sampleEmployees = [
    {
      id: 'usr_1',
      name: 'Denver Broker',
      email: 'broker@capitalbridgelogistics.com',
      empId: 'EMP001',
      role: { code: 'BROKER', name: 'Broker' },
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navbar Admin Shifts Link', () => {
    const baseUser = {
      id: 'usr_1',
      name: 'Test User',
      email: 'user@capitalbridgelogistics.com',
      designation: { name: 'Lead' },
    };

    it('shows Shifts link (/admin/shifts) for ADMIN and hides it for BROKER', () => {
      const { rerender } = render(
        <Navbar
          user={{ ...baseUser, role: { code: 'BROKER', name: 'Broker' } }}
          initialPendingLeaveCount={0}
        />
      );
      expect(screen.queryByRole('link', { name: /^shifts$/i })).toBeNull();

      rerender(
        <Navbar
          user={{ ...baseUser, role: { code: 'ADMIN', name: 'Admin' } }}
          initialPendingLeaveCount={0}
        />
      );
      expect(screen.getByRole('link', { name: /^shifts$/i })).toHaveAttribute(
        'href',
        '/admin/shifts'
      );
    });
  });

  describe('ShiftMasterManager', () => {
    it('creates a new custom shift via POST /api/admin/shifts and toggles active status', async () => {
      const onRefresh = vi.fn();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, shift: { id: 'sh_2000', code: 'SHIFT_2000' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, shift: { ...sampleShifts[0], isActive: false } }),
        });

      render(<ShiftMasterManager shifts={sampleShifts} onRefresh={onRefresh} />);

      expect(screen.getByText('19:00 - 03:30 IST')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/shift code/i), { target: { value: 'SHIFT_2000' } });
      fireEvent.change(screen.getByLabelText(/display name/i), {
        target: { value: '20:00 - 04:30 IST' },
      });
      fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '20:00' } });
      fireEvent.click(screen.getByRole('button', { name: /create shift/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/shifts',
          expect.objectContaining({ method: 'POST' })
        );
        expect(onRefresh).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/shifts/sh_1900',
          expect.objectContaining({ method: 'PATCH' })
        );
      });
    });
  });

  describe('ShiftAssignmentModal', () => {
    it('submits assignment and displays inline conflict error when API returns 409', async () => {
      const onClose = vi.fn();
      const onAssigned = vi.fn();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: {
                code: 'SHIFT_OVERLAPPING_ASSIGNMENT',
                message: 'Employee already has an overlapping shift assignment for the selected date range.',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, assignment: { id: 'asg_1' } }),
        });

      render(
        <ShiftAssignmentModal
          isOpen={true}
          employees={sampleEmployees}
          shifts={sampleShifts}
          onClose={onClose}
          onAssigned={onAssigned}
        />
      );

      fireEvent.change(screen.getByLabelText(/effective from/i), {
        target: { value: '2026-12-01' },
      });
      fireEvent.click(screen.getByRole('button', { name: /assign shift/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/overlapping shift assignment for the selected date range/i)
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /assign shift/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/shift-assignments',
          expect.objectContaining({ method: 'POST' })
        );
        expect(onAssigned).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});

