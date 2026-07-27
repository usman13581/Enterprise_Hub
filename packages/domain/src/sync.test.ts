import { describe, expect, it } from 'vitest';
import {
  isServerProtected,
  resolveSyncWrite,
} from './sync';

describe('sync conflicts', () => {
  it('treats approved quotations as server-protected', () => {
    expect(isServerProtected('quotation', 'draft')).toBe(false);
    expect(isServerProtected('quotation', 'approved')).toBe(true);
    expect(isServerProtected('invoice', 'issued')).toBe(true);
    expect(isServerProtected('job', 'closed')).toBe(true);
    expect(isServerProtected('customer', 'active')).toBe(false);
  });

  it('applies creates when the row is missing', () => {
    expect(
      resolveSyncWrite({
        entity: 'customer',
        clientUpdatedAt: '2026-01-02T00:00:00.000Z',
        clientVersion: 1,
        server: null,
      }),
    ).toBe('apply');
  });

  it('rejects edits to approved / issued / closed rows', () => {
    expect(
      resolveSyncWrite({
        entity: 'quotation',
        clientUpdatedAt: '2026-06-01T00:00:00.000Z',
        clientVersion: 9,
        server: {
          updatedAt: '2026-01-01T00:00:00.000Z',
          version: 1,
          status: 'approved',
        },
      }),
    ).toBe('reject_server_wins');
  });

  it('uses version then updatedAt for last-write-wins on drafts', () => {
    expect(
      resolveSyncWrite({
        entity: 'supplier',
        clientUpdatedAt: '2026-02-01T00:00:00.000Z',
        clientVersion: 2,
        server: {
          updatedAt: '2026-03-01T00:00:00.000Z',
          version: 3,
          status: null,
        },
      }),
    ).toBe('reject_stale');

    expect(
      resolveSyncWrite({
        entity: 'supplier',
        clientUpdatedAt: '2026-04-01T00:00:00.000Z',
        clientVersion: 3,
        server: {
          updatedAt: '2026-03-01T00:00:00.000Z',
          version: 3,
          status: null,
        },
      }),
    ).toBe('apply');
  });
});
