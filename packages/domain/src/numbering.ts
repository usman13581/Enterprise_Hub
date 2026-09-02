/**
 * Document numbers are per company and per document family, zero padded so they
 * sort lexicographically in lists and PDFs (BM-QT-0007, BM-INV-0142).
 */
export function formatDocumentNumber(
  prefix: string,
  sequence: number,
  padTo = 4,
): string {
  const clean = prefix.trim().replace(/-+$/, '');
  return `${clean}-${String(sequence).padStart(padTo, '0')}`;
}

/** True when the number is a revision suffix (e.g. QT-0001-R2). */
export function isRevisionDocumentNumber(value: string): boolean {
  return /-R\d+$/i.test(value.trim());
}

/** Reads the numeric tail back out of a formatted document number. */
export function parseDocumentSequence(value: string): number {
  const base = isRevisionDocumentNumber(value)
    ? value.replace(/-R\d+$/i, '')
    : value;
  const match = /(\d+)\s*$/.exec(base.trim());
  return match ? Number(match[1]) : 0;
}

export function nextSequence(existingNumbers: string[]): number {
  const baseNumbers = existingNumbers.filter(
    (value) => !isRevisionDocumentNumber(value),
  );
  const highest = baseNumbers.reduce(
    (max, value) => Math.max(max, parseDocumentSequence(value)),
    0,
  );
  return highest + 1;
}
