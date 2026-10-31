export function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}
