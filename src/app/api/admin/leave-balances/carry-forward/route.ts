import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireAdminUser } from '@/lib/apiHelpers';
import { runCarryForwardRollover } from '@/service/leaveBalance.service';

const rolloverSchema = z.object({
  fromYear: z.number().int().min(2020).max(2100),
  toYear: z.number().int().min(2021).max(2101),
  userId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminUser();
    if (response) return response;

    const body = await request.json().catch(() => null);
    const parsed = rolloverSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid carry-forward rollover payload.', 400);
    }

    const result = await runCarryForwardRollover(
      parsed.data.fromYear,
      parsed.data.toYear,
      parsed.data.userId
    );
    if (!result.success) {
      return errorResponse(result.error.code, result.error.message, result.error.status ?? 400);
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to execute carry-forward rollover.', 500);
  }
}

