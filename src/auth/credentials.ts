export const DEFAULT_STAFF_PERMISSIONS = ['view-dashboard', 'use-pos', 'view-products', 'view-eod', 'view-operations', 'generate-reports'];

export function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || normalized.length > 100) {
    throw new Error('Enter a name between 1 and 100 characters.');
  }
  const localPart = normalized.replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  if (!localPart || localPart.length > 64) {
    throw new Error('Use a name with letters or numbers that fits within 64 characters.');
  }
  return `${localPart}@staff.superpos.invalid`;
}
