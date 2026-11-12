export function normalizePublicIntakeName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

// Public submissions only: staff can still work with existing one-word names.
export function publicIntakeNameError(value: unknown): string | null {
  const name = normalizePublicIntakeName(value);
  return name.split(' ').filter(Boolean).length >= 2
    ? null
    : 'Please enter both your first and last name.';
}
