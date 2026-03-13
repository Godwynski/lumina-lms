export function generateCardNumber(): string {
  const year = new Date().getFullYear().toString();
  // Generate a random 8-character hex segment
  const randomSegment = Math.random().toString(16).substring(2, 10).toUpperCase();
  return `LIB-${year}-${randomSegment}`;
}
