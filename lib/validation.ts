export function checkInt(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    return `Must be a whole number between ${min} and ${max}`;
  }
  return null;
}

export function checkYards(v: unknown, max: number): string | null {
  if (
    typeof v !== 'number' ||
    !Number.isFinite(v) ||
    v <= 0 ||
    v > max ||
    Math.round(v * 100) / 100 !== v
  ) {
    return `Must be a positive number (max 2 decimals, up to ${max})`;
  }
  return null;
}

export function checkRollId(v: unknown): string | null {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,50}$/.test(v.trim())) {
    return 'Use letters, digits, - or _ (max 50 characters)';
  }
  return null;
}