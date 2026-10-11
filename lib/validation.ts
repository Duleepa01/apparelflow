export function checkInt(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    return `Must be a whole number between ${min} and ${max}`;
  }
  return null;
}

export function checkYards(v: unknown, max: number): string | null {
  return checkInt(v, 1, max) ? `Must be a whole number between 1 and ${max}` : null;
}
export function checkRollId(v: unknown): string | null {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,50}$/.test(v.trim())) {
    return 'Use letters, digits, - or _ (max 50 characters)';
  }
  return null;
}