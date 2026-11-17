import { HttpException, NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { AutopendKeyGuard } from './autopend-key.guard';
import type { AutopendService } from './autopend.service';
import { LicenseEnforcementGuard } from './license-enforcement.guard';
import type { LicenseState } from './license-state';

const ctx = (method: string, url: string, headers: Record<string, string> = {}) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url, url, headers }) }),
  }) as unknown as ExecutionContext;

const state = (o: Partial<LicenseState> = {}): LicenseState => ({ mode: 'OK', readOnly: false, message: null, daysLeft: null, ...o });
const serviceReturning = (s: LicenseState | Error) =>
  ({ currentState: jest.fn(async () => { if (s instanceof Error) throw s; return s; }) }) as unknown as AutopendService & { currentState: jest.Mock };

describe('LicenseEnforcementGuard', () => {
  it('lets a normal restaurant trade', async () => {
    const g = new LicenseEnforcementGuard(serviceReturning(state()));
    await expect(g.canActivate(ctx('POST', '/api/v1/orders'))).resolves.toBe(true);
  });

  it('refuses changes with 402 and a reason when read-only, but lets reading, sign-in and payment notices through', async () => {
    const svc = serviceReturning(state({ mode: 'READ_ONLY', readOnly: true, message: 'Payment overdue' }));
    const g = new LicenseEnforcementGuard(svc);
    const err = await g.canActivate(ctx('POST', '/api/v1/orders')).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(402);
    expect(err.getResponse()).toMatchObject({ code: 'LICENSE_INACTIVE', message: 'Payment overdue' });

    await expect(g.canActivate(ctx('GET', '/api/v1/orders'))).resolves.toBe(true);
    await expect(g.canActivate(ctx('POST', '/api/v1/auth/login'))).resolves.toBe(true);
    await expect(g.canActivate(ctx('POST', '/api/v1/payment-gateways/webhook/r/razorpay/live'))).resolves.toBe(true);
    await expect(g.canActivate(ctx('POST', '/api/v1/public/kiosk/abc/orders'))).rejects.toBeInstanceOf(HttpException);
  });

  it('does not even look up the licence for reads', async () => {
    const svc = serviceReturning(state({ readOnly: true }));
    await new LicenseEnforcementGuard(svc).canActivate(ctx('GET', '/api/v1/tables'));
    expect(svc.currentState).not.toHaveBeenCalled();
  });

  it('keeps the till working if the licence cannot be read', async () => {
    const g = new LicenseEnforcementGuard(serviceReturning(new Error('database down')));
    await expect(g.canActivate(ctx('POST', '/api/v1/orders'))).resolves.toBe(true);
  });
});

describe('AutopendKeyGuard', () => {
  const KEY = 'k'.repeat(40);
  const before = process.env.AUTOPEND_ADMIN_KEY;
  afterEach(() => {
    if (before === undefined) delete process.env.AUTOPEND_ADMIN_KEY;
    else process.env.AUTOPEND_ADMIN_KEY = before;
  });

  it('does not exist on a server without a key', () => {
    delete process.env.AUTOPEND_ADMIN_KEY;
    expect(() => new AutopendKeyGuard().canActivate(ctx('GET', '/api/v1/autopend/stats', { 'x-autopend-key': KEY }))).toThrow(NotFoundException);
  });

  it('refuses a short key even if it matches', () => {
    process.env.AUTOPEND_ADMIN_KEY = 'short';
    expect(() => new AutopendKeyGuard().canActivate(ctx('GET', '/x', { 'x-autopend-key': 'short' }))).toThrow(NotFoundException);
  });

  it('accepts only the exact key', () => {
    process.env.AUTOPEND_ADMIN_KEY = KEY;
    const g = new AutopendKeyGuard();
    expect(g.canActivate(ctx('GET', '/x', { 'x-autopend-key': KEY }))).toBe(true);
    expect(() => g.canActivate(ctx('GET', '/x', { 'x-autopend-key': KEY + 'x' }))).toThrow(UnauthorizedException);
    expect(() => g.canActivate(ctx('GET', '/x', { 'x-autopend-key': '' }))).toThrow(UnauthorizedException);
    expect(() => g.canActivate(ctx('GET', '/x', {}))).toThrow(UnauthorizedException);
  });
});
