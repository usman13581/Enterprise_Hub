import { describe, expect, it } from 'vitest';
import {
  hrAttendanceCheckInSchema,
  hrEmployeeSchema,
  hrEmployeeUpdateSchema,
  hrLeaveRequestSchema,
  hrOvertimeSchema,
} from '@marble/types';

describe('HR request contracts', () => {
  it('normalizes an employee payload and rejects missing identity', () => {
    expect(hrEmployeeSchema.parse({
      firstName: '  Aisha ',
      joiningDate: '2026-08-31',
    })).toMatchObject({
      firstName: 'Aisha',
      employmentType: 'full_time',
      status: 'active',
    });
    expect(() => hrEmployeeSchema.parse({ joiningDate: '2026-08-31' })).toThrow();
  });

  it('keeps attendance capture metadata numeric and bounded', () => {
    expect(hrAttendanceCheckInSchema.parse({
      capturedAt: '2026-08-31T12:00:00.000Z',
      accuracyMeters: '12',
    })).toMatchObject({ accuracyMeters: 12, context: 'office' });
  });

  it('requires valid leave and overtime essentials', () => {
    expect(() => hrLeaveRequestSchema.parse({
      leaveTypeId: 'annual',
      startDate: '2026-08-31',
      endDate: '2026-09-02',
    })).not.toThrow();
    expect(() => hrOvertimeSchema.parse({
      workDate: '2026-08-31',
      startedAt: '2026-08-31T18:00:00Z',
      endedAt: '2026-08-31T19:00:00Z',
      reason: 'Month end',
    })).not.toThrow();
  });

  it('allows partial employee updates', () => {
    expect(hrEmployeeUpdateSchema.parse({ emiratesIdNumber: 'AB-123456789' })).toEqual({
      emiratesIdNumber: 'AB-123456789',
    });
  });
});
