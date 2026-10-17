export function randomId(bytes = 12): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, bytes * 2);
}
