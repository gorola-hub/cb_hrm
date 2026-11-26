import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  listShifts,
  createShift,
  updateShift,
  assignEmployeeShift,
  listEmployeeShiftAssignments,
  updateEmployeeShiftAssignment,
  deleteEmployeeShiftAssignment,
} from '@/service/shift.service';
import { getUserActiveShift } from '@/repository/attendance.repository';
import { prisma } from '@/lib/prisma';

describe('Phase 9: Shift Master & Employee Shift Assignment (FR-ADM-005)', () => {
  let brokerId: string;
  let shift1900Id: string;
  const createdShiftCodes: string[] = [];

  async function resetBrokerShiftToDefault() {
    if (!brokerId) return;
    await prisma.employeeShift.deleteMany({ where: { userId: brokerId } });
    if (shift1900Id) {
      await prisma.employeeShift.create({
        data: {
          userId: brokerId,
          shiftId: shift1900Id,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
  }

  async function cleanupCreatedShifts() {
    if (createdShiftCodes.length > 0) {
      await prisma.employeeShift.deleteMany({
        where: { shift: { code: { in: createdShiftCodes } } },
      });
      await prisma.shift.deleteMany({
        where: { code: { in: createdShiftCodes } },
      });
    }
  }

  beforeEach(async () => {
    const broker = await prisma.user.findFirst({
      where: { email: 'broker@capitalbridgelogistics.com' },
    });
    const shift1900 = await prisma.shift.findUnique({ where: { code: 'SHIFT_1900' } });
    if (!broker || !shift1900) throw new Error('Seeded broker or SHIFT_1900 not found');

    brokerId = broker.id;
    shift1900Id = shift1900.id;

    await cleanupCreatedShifts();
    await prisma.employeeShift.deleteMany({ where: { userId: brokerId } });
  });

  afterAll(async () => {
    await cleanupCreatedShifts();
    await resetBrokerShiftToDefault();
    await prisma.$disconnect();
  });

  it('lists all seeded master shifts with active assignment counts', async () => {
    const shifts = await listShifts();
    expect(shifts.length).toBeGreaterThanOrEqual(6);
    expect(shifts.some((s) => s.code === 'SHIFT_1900')).toBe(true);
  });

  it('creates custom shift (uppercase normalized), validates time/duration, rejects duplicate, and updates fields', async () => {
    createdShiftCodes.push('SHIFT_2000');

    const created = await createShift({
      code: 'shift_2000',
      displayName: '20:00 - 04:30 IST',
      startTime: '20:00',
      durationMins: 510,
      graceMinutes: 15,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.shift.code).toBe('SHIFT_2000');
    expect(created.shift.startTime).toBe('20:00');

    // Duplicate code -> 409 SHIFT_DUPLICATE
    const dup = await createShift({
      code: 'SHIFT_2000',
      displayName: 'Duplicate',
      startTime: '20:00',
      durationMins: 510,
      graceMinutes: 15,
    });
    expect(dup.success).toBe(false);
    if (!dup.success) {
      expect(dup.error.code).toBe('SHIFT_DUPLICATE');
    }

    // Invalid HH:mm -> 400 VALIDATION_ERROR
    const badTime = await createShift({
      code: 'SHIFT_BAD',
      displayName: 'Bad',
      startTime: '25:99',
      durationMins: 510,
      graceMinutes: 15,
    });
    expect(badTime.success).toBe(false);

    // Update shift grace period & active flag
    const updated = await updateShift(created.shift.id, {
      graceMinutes: 20,
      isActive: false,
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.shift.graceMinutes).toBe(20);
      expect(updated.shift.isActive).toBe(false);
    }
  });

  it('assigns shift, rejects inactive shifts & invalid date range, and prevents overlapping assignments', async () => {
    createdShiftCodes.push('SHIFT_INACTIVE_TEST');

    const inactive = await createShift({
      code: 'SHIFT_INACTIVE_TEST',
      displayName: 'Inactive Shift',
      startTime: '10:00',
      durationMins: 480,
      graceMinutes: 10,
      isActive: false,
    });
    expect(inactive.success).toBe(true);
    if (!inactive.success) return;

    // Inactive shift rejected
    const inactiveAssign = await assignEmployeeShift({
      userId: brokerId,
      shiftId: inactive.shift.id,
      effectiveFrom: '2026-11-01',
    });
    expect(inactiveAssign.success).toBe(false);
    if (!inactiveAssign.success) {
      expect(inactiveAssign.error.code).toBe('SHIFT_INACTIVE');
    }

    // effectiveTo < effectiveFrom rejected
    const badRange = await assignEmployeeShift({
      userId: brokerId,
      shiftId: shift1900Id,
      effectiveFrom: '2026-11-15',
      effectiveTo: '2026-11-10',
    });
    expect(badRange.success).toBe(false);

    // Bounded assignment Nov 1 - Nov 30
    const first = await assignEmployeeShift({
      userId: brokerId,
      shiftId: shift1900Id,
      effectiveFrom: '2026-11-01',
      effectiveTo: '2026-11-30',
      autoClosePrevious: false,
    });
    expect(first.success).toBe(true);

    // Overlapping assignment Nov 15 - Dec 15 with autoClosePrevious = false -> 409 SHIFT_OVERLAPPING_ASSIGNMENT
    const shift1800 = await prisma.shift.findUniqueOrThrow({ where: { code: 'SHIFT_1800' } });
    const overlap = await assignEmployeeShift({
      userId: brokerId,
      shiftId: shift1800.id,
      effectiveFrom: '2026-11-15',
      effectiveTo: '2026-12-15',
      autoClosePrevious: false,
    });
    expect(overlap.success).toBe(false);
    if (!overlap.success) {
      expect(overlap.error.code).toBe('SHIFT_OVERLAPPING_ASSIGNMENT');
    }
  });

  it('auto-closes prior open-ended assignment on reassignment and resolves active shift by effective date', async () => {
    const shift1800 = await prisma.shift.findUniqueOrThrow({ where: { code: 'SHIFT_1800' } });

    // Initial open-ended assignment starting 2026-01-01
    const first = await assignEmployeeShift({
      userId: brokerId,
      shiftId: shift1900Id,
      effectiveFrom: '2026-01-01',
      autoClosePrevious: true,
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    // Reassign to SHIFT_1800 starting 2026-12-01 (in the future relative to 2026-11-26!)
    const second = await assignEmployeeShift({
      userId: brokerId,
      shiftId: shift1800.id,
      effectiveFrom: '2026-12-01',
      autoClosePrevious: true,
    });
    expect(second.success).toBe(true);
    if (!second.success) return;

    // Prior assignment now has effectiveTo set right before new effectiveFrom
    const assignments = await listEmployeeShiftAssignments({ userId: brokerId });
    const prev = assignments.find((a) => a.id === first.assignment.id);
    expect(prev?.effectiveTo).not.toBeNull();

    // Active shift on 2026-11-26 is still SHIFT_1900 (future Dec 1 assignment not yet active!)
    const activeNov = await getUserActiveShift(brokerId, new Date('2026-11-26T13:30:00.000Z'));
    expect(activeNov?.code).toBe('SHIFT_1900');

    // Active shift on 2026-12-05 is SHIFT_1800
    const activeDec = await getUserActiveShift(brokerId, new Date('2026-12-05T13:30:00.000Z'));
    expect(activeDec?.code).toBe('SHIFT_1800');

    // Update & delete assignment helpers work
    const patched = await updateEmployeeShiftAssignment(second.assignment.id, {
      effectiveTo: '2026-12-31',
    });
    expect(patched.success).toBe(true);

    const deleted = await deleteEmployeeShiftAssignment(second.assignment.id);
    expect(deleted.success).toBe(true);
  });
});

