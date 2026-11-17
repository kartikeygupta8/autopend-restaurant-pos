// AutoPend hosting: whether this restaurant's subscription lets it keep working.
//
// The AutoPend admin portal pushes a small record here (status, access-until date, grace days). This file turns it
// into one of four modes. It is deliberately pure so the rules can be tested without a database.
//
// A server with no record at all is unmanaged (a self-hosted install) and is never restricted.

export type LicenseStatus = 'ACTIVE' | 'SUSPENDED';

export interface LicenseRecord {
  status: LicenseStatus;
  /** Last day of access. After it, a grace period runs, then the app turns read-only. */
  expiresAt: Date | null;
  graceDays: number;
  message: string | null;
}

export type LicenseMode = 'OK' | 'EXPIRING' | 'GRACE' | 'READ_ONLY';

export interface LicenseState {
  mode: LicenseMode;
  /** True when changes (new orders, edits) must be refused. Reading and exporting data always works. */
  readOnly: boolean;
  message: string | null;
  /** Days until access ends (EXPIRING), or until it turns read-only (GRACE). */
  daysLeft: number | null;
}

const DAY = 86_400_000;
const WARN_DAYS = 7;

export const SUSPENDED_MESSAGE =
  'This account is suspended, so changes are switched off. Your data is safe and can still be viewed and exported. Please contact AutoPend.';

export function evaluateLicense(
  record: LicenseRecord | null,
  now: Date,
): LicenseState {
  if (!record) return { mode: 'OK', readOnly: false, message: null, daysLeft: null };

  if (record.status === 'SUSPENDED') {
    return {
      mode: 'READ_ONLY',
      readOnly: true,
      message: record.message?.trim() || SUSPENDED_MESSAGE,
      daysLeft: null,
    };
  }

  if (!record.expiresAt) return { mode: 'OK', readOnly: false, message: null, daysLeft: null };

  const end = record.expiresAt.getTime();
  const grace = Math.max(0, Math.min(60, Math.floor(record.graceDays)));
  const nowMs = now.getTime();

  if (nowMs <= end) {
    const daysLeft = Math.ceil((end - nowMs) / DAY);
    if (daysLeft <= WARN_DAYS) {
      return {
        mode: 'EXPIRING',
        readOnly: false,
        message: `Your AutoPend subscription ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Please renew to avoid interruption.`,
        daysLeft,
      };
    }
    return { mode: 'OK', readOnly: false, message: null, daysLeft };
  }

  const graceEnd = end + grace * DAY;
  if (nowMs <= graceEnd) {
    const daysLeft = Math.ceil((graceEnd - nowMs) / DAY);
    return {
      mode: 'GRACE',
      readOnly: false,
      message: `Your AutoPend subscription has ended. Everything keeps working for ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}, then changes will be switched off. Please renew now.`,
      daysLeft,
    };
  }

  return {
    mode: 'READ_ONLY',
    readOnly: true,
    message:
      record.message?.trim() ||
      'Your AutoPend subscription has ended, so changes are switched off. Your data is safe and can still be viewed and exported. Please renew.',
    daysLeft: 0,
  };
}

/** Paths that must keep working even when the app is read-only: sign in, see why, and signature-checked notices about money already taken. Reading and exporting data are GETs, so they always work. */
const ALWAYS_ALLOWED = ['/api/v1/auth', '/api/v1/autopend', '/api/v1/payment-gateways/webhook', '/api/v1/integration-hub/webhook'];

export function isAllowedWhileReadOnly(method: string, path: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  const p = (path.split('?')[0] ?? '').replace(/\/+$/, '');
  // Exactly the path or something under it, so "/api/v1/authority" or "/api/v1/backupx" do not match.
  return ALWAYS_ALLOWED.some((base) => p === base || p.startsWith(`${base}/`));
}
