/** Local calendar YYYY-MM-DD for date inputs. Avoids UTC midnight shifting a day in UAE. */
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function todayIso() {
  return isoDate();
}

export function dueDateIso() {
  return isoDate(addDays(new Date(), 30));
}

/** Stored ISO datetime or date-only → YYYY-MM-DD for inputs. Empty if missing. */
export function dateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}
