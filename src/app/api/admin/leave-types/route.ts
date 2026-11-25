import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { createLeaveType, listLeaveTypes } from '@/service/leaveType.service';

const createLeaveTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  defaultAnnualDays: z.number(),
  allowCarryForward: z.boolean().optional().default(false),
  maxCarryForwardDays: z.number().optional().default(0),
  isPaid: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const leaveTypes = await listLeaveTypes(false);
    return NextResponse.json({ success: true, leaveTypes }, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to load leave types.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => null);
    const parsed = createLeaveTypeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid leave type payload.', 400);
    }

    const result = await createLeaveType(parsed.data);
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json({ success: true, leaveType: result.leaveType }, { status: 201 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to create leave type.', 500);
  }
}

