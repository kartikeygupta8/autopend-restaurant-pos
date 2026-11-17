import { BadRequestException } from '@nestjs/common';
import { AutopendService } from './autopend.service';

function prismaStub(over: Record<string, unknown> = {}) {
  let license: Record<string, unknown> | null = null;
  const stub = {
    autopendLicense: {
      findUnique: jest.fn(async () => license),
      upsert: jest.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        license = license ? { ...license, ...update } : { ...create };
        return license;
      }),
    },
    restaurant: { findFirst: jest.fn(async () => ({ name: 'Spice Route', timezone: 'Asia/Kolkata', currency: 'INR' })) },
    order: {
      count: jest.fn(async () => 4),
      aggregate: jest.fn(async () => ({ _sum: { totalAmount: { toString: () => '1250.50' } } })),
      findFirst: jest.fn(async () => ({ createdAt: new Date('2026-11-17T08:00:00Z') })),
    },
    auditLog: { findFirst: jest.fn(async () => ({ createdAt: new Date('2026-11-17T09:30:00Z') })) },
    user: { count: jest.fn(async () => 3) },
    branch: { count: jest.fn(async () => 1) },
    table: { count: jest.fn(async () => 12) },
    menuItem: { count: jest.fn(async () => 40) },
    ...over,
  };
  return stub;
}
const make = (p = prismaStub()) => ({ svc: new AutopendService(p as never), p });

describe('AutopendService licence', () => {
  it('has no restrictions until the portal sets a licence, then obeys it at once', async () => {
    const { svc } = make();
    expect((await svc.currentState()).readOnly).toBe(false);
    const after = await svc.setLicense({ status: 'SUSPENDED', expiresAt: null, graceDays: 3, message: null });
    expect(after.readOnly).toBe(true);
    expect((await svc.currentState()).readOnly).toBe(true); // the cache was cleared by the change
    expect((await svc.setLicense({ status: 'ACTIVE', expiresAt: null, graceDays: 3, message: null })).readOnly).toBe(false);
  });

  it('checks what the portal sends', () => {
    const { svc } = make();
    expect(svc.parseLicense({ status: 'ACTIVE', expiresAt: '2027-01-31', graceDays: 5, message: '  hi ' })).toMatchObject({ status: 'ACTIVE', graceDays: 5, message: 'hi' });
    expect(svc.parseLicense({ status: 'ACTIVE' })).toMatchObject({ expiresAt: null, graceDays: 3, message: null });
    expect(() => svc.parseLicense({ status: 'PAUSED' })).toThrow(BadRequestException);
    expect(() => svc.parseLicense({ status: 'ACTIVE', expiresAt: 'tomorrow-ish' })).toThrow(BadRequestException);
    expect(() => svc.parseLicense({ status: 'ACTIVE', graceDays: 500 })).toThrow(BadRequestException);
    expect(() => svc.parseLicense({ status: 'ACTIVE', graceDays: 1.5 })).toThrow(BadRequestException);
    expect(svc.parseLicense({ status: 'ACTIVE', message: 'x'.repeat(1000) }).message).toHaveLength(300);
  });
});

describe('AutopendService stats', () => {
  it('reports the numbers the portal shows, as plain text and numbers', async () => {
    const { svc } = make();
    const s = await svc.stats(new Date('2026-11-17T10:00:00Z'));
    expect(s.restaurant).toEqual({ name: 'Spice Route', timezone: 'Asia/Kolkata', currency: 'INR' });
    expect(s.orders.today).toEqual({ orders: 4, revenue: '1250.50' });
    expect(s.orders.lastOrderAt).toBe('2026-11-17T08:00:00.000Z');
    expect(s.lastActivityAt).toBe('2026-11-17T09:30:00.000Z'); // the later of the last order and the last audited change
    expect(s.staff).toEqual({ active: 3, total: 3 });
    expect([s.branches, s.tables, s.menuItems]).toEqual([1, 12, 40]);
    expect(s.license.mode).toBe('OK');
    expect(JSON.stringify(s)).not.toMatch(/password|secret|token|key/i);
  });

  it('counts "today" from midnight in the restaurant time zone, not the server time zone', async () => {
    const p = prismaStub();
    const { svc } = make(p);
    await svc.stats(new Date('2026-11-17T20:00:00Z')); // 01:30 on the 18th in India
    const todayFilter = (p.order.count.mock.calls[0] as unknown as [{ where: { createdAt: { gte: Date } } }])[0].where.createdAt.gte;
    expect(todayFilter.toISOString()).toBe('2026-11-17T18:30:00.000Z'); // midnight 18 Nov in India
  });

  it('works on a brand-new restaurant with nothing in it', async () => {
    const p = prismaStub({
      restaurant: { findFirst: jest.fn(async () => null) },
      order: { count: jest.fn(async () => 0), aggregate: jest.fn(async () => ({ _sum: { totalAmount: null } })), findFirst: jest.fn(async () => null) },
      auditLog: { findFirst: jest.fn(async () => null) },
    });
    const s = await make(p).svc.stats();
    expect(s.orders.today).toEqual({ orders: 0, revenue: '0' });
    expect(s.lastActivityAt).toBeNull();
    expect(s.restaurant).toBeNull();
  });
});
