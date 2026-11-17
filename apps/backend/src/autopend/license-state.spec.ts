import {
  evaluateLicense,
  isAllowedWhileReadOnly,
  SUSPENDED_MESSAGE,
  type LicenseRecord,
} from './license-state';

const NOW = new Date('2026-11-17T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const rec = (o: Partial<LicenseRecord> = {}): LicenseRecord => ({
  status: 'ACTIVE',
  expiresAt: null,
  graceDays: 3,
  message: null,
  ...o,
});

describe('evaluateLicense', () => {
  it('never restricts an install the portal does not manage', () => {
    expect(evaluateLicense(null, NOW)).toEqual({ mode: 'OK', readOnly: false, message: null, daysLeft: null });
  });

  it('active with no end date is fine', () => {
    expect(evaluateLicense(rec(), NOW).mode).toBe('OK');
  });

  it('a suspended account is read-only at once, with the portal message or a default', () => {
    const s = evaluateLicense(rec({ status: 'SUSPENDED' }), NOW);
    expect(s).toMatchObject({ mode: 'READ_ONLY', readOnly: true, message: SUSPENDED_MESSAGE });
    expect(evaluateLicense(rec({ status: 'SUSPENDED', message: ' Payment overdue ' }), NOW).message).toBe('Payment overdue');
  });

  it('warns during the last 7 days but keeps working', () => {
    const s = evaluateLicense(rec({ expiresAt: day(3) }), NOW);
    expect(s).toMatchObject({ mode: 'EXPIRING', readOnly: false, daysLeft: 3 });
    expect(evaluateLicense(rec({ expiresAt: day(8) }), NOW).mode).toBe('OK');
  });

  it('after the end date it keeps working for the grace days, then goes read-only', () => {
    const grace = evaluateLicense(rec({ expiresAt: day(-1), graceDays: 3 }), NOW);
    expect(grace).toMatchObject({ mode: 'GRACE', readOnly: false, daysLeft: 2 });
    const over = evaluateLicense(rec({ expiresAt: day(-4), graceDays: 3 }), NOW);
    expect(over).toMatchObject({ mode: 'READ_ONLY', readOnly: true, daysLeft: 0 });
  });

  it('zero grace days means read-only straight after the end date', () => {
    expect(evaluateLicense(rec({ expiresAt: day(-0.5), graceDays: 0 }), NOW).readOnly).toBe(true);
  });

  it('reactivating (active, later date) lifts the restriction', () => {
    expect(evaluateLicense(rec({ status: 'ACTIVE', expiresAt: day(30) }), NOW).readOnly).toBe(false);
  });

  it('a silly grace value is clamped', () => {
    expect(evaluateLicense(rec({ expiresAt: day(-30), graceDays: 9999 }), NOW).mode).toBe('GRACE'); // capped at 60, so 30 days late is still inside it
    expect(evaluateLicense(rec({ expiresAt: day(-90), graceDays: 9999 }), NOW).mode).toBe('READ_ONLY'); // but never unlimited
    expect(evaluateLicense(rec({ expiresAt: day(-1), graceDays: -5 }), NOW).readOnly).toBe(true);
  });
});

describe('isAllowedWhileReadOnly', () => {
  it('lets people read and export, sign in, and lets payment notices through', () => {
    expect(isAllowedWhileReadOnly('GET', '/api/v1/orders')).toBe(true);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/auth/login')).toBe(true);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/auth/logout')).toBe(true);
    expect(isAllowedWhileReadOnly('PUT', '/api/v1/autopend/license')).toBe(true);
    expect(isAllowedWhileReadOnly('GET', '/api/v1/backups/export')).toBe(true);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/payment-gateways/webhook/r1/razorpay/live')).toBe(true);
  });

  it('refuses everything that changes the restaurant, including guest ordering', () => {
    expect(isAllowedWhileReadOnly('POST', '/api/v1/orders')).toBe(false);
    expect(isAllowedWhileReadOnly('PATCH', '/api/v1/menu/items/1')).toBe(false);
    expect(isAllowedWhileReadOnly('DELETE', '/api/v1/tables/9')).toBe(false);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/public/order/abc')).toBe(false);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/backups/b1/restore')).toBe(false);
  });

  it('does not let a look-alike path through', () => {
    expect(isAllowedWhileReadOnly('POST', '/api/v1/authority/orders')).toBe(false);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/payment-gateways/webhooks-fake')).toBe(false);
    expect(isAllowedWhileReadOnly('POST', '/api/v1/orders?x=/api/v1/auth/')).toBe(false);
  });
});
