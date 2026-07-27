import { describe, expect, it } from 'vitest';
import {
  formatDocumentNumber,
  nextSequence,
  parseDocumentSequence,
} from './numbering';

describe('formatDocumentNumber', () => {
  it('zero pads so numbers sort lexicographically', () => {
    expect(formatDocumentNumber('BM-QT', 7)).toBe('BM-QT-0007');
    expect(formatDocumentNumber('BM-QT', 142)).toBe('BM-QT-0142');
    expect(
      ['BM-QT-0009', 'BM-QT-0010'].slice().sort(),
    ).toEqual(['BM-QT-0009', 'BM-QT-0010']);
  });

  it('does not double the separator when the prefix ends with one', () => {
    expect(formatDocumentNumber('BM-INV-', 1)).toBe('BM-INV-0001');
  });

  it('keeps growing past the padding width', () => {
    expect(formatDocumentNumber('QT', 123456)).toBe('QT-123456');
  });
});

describe('parseDocumentSequence', () => {
  it('reads the numeric tail back', () => {
    expect(parseDocumentSequence('BM-INV-0142')).toBe(142);
  });

  it('returns zero when there is no numeric tail', () => {
    expect(parseDocumentSequence('DRAFT')).toBe(0);
  });
});

describe('nextSequence', () => {
  it('continues from the highest existing number', () => {
    expect(nextSequence(['BM-QT-0001', 'BM-QT-0009', 'BM-QT-0004'])).toBe(10);
  });

  it('starts at one for a company with no documents', () => {
    expect(nextSequence([])).toBe(1);
  });

  it('is not confused by digits inside the prefix', () => {
    expect(nextSequence(['B2B-QT-0003'])).toBe(4);
  });
});
