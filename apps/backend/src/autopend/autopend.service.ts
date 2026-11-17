import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addDaysToDate, localDate, zonedDayStart } from '../common/time';
import {
  evaluateLicense,
  type LicenseRecord,
  type LicenseState,
  type LicenseStatus,
} from './license-state';

const CACHE_MS = 15_000;

export interface WindowTotals {
  /** Orders placed in the window that were not cancelled. */
  orders: number;
  /** Total of the bills that were paid, as a decimal string in the restaurant's currency. */
  revenue: string;
}

export interface AutopendStats {
  version: string;
  commit: string | null;
  now: string;
  uptimeSeconds: number;
  restaurant: { name: string; timezone: string; currency: string } | null;
  orders: {
    today: WindowTotals;
    last7Days: WindowTotals;
    last30Days: WindowTotals;
    openNow: number;
    lastOrderAt: string | null;
  };
  staff: { active: number; total: number };
  branches: number;
  tables: number;
  menuItems: number;
  /** The last time anyone did anything that was recorded (an order or an audited change). */
  lastActivityAt: string | null;
  license: LicenseState;
}

export interface LicenseInput {
  status: LicenseStatus;
  expiresAt: Date | null;
  graceDays: number;
  message: string | null;
}

@Injectable()
export class AutopendService {
  private cache: { at: number; record: LicenseRecord | null } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ---------------- licence ----------------

  async getRecord(): Promise<LicenseRecord | null> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.record;
    const row = await this.prisma.autopendLicense.findUnique({ where: { id: 'singleton' } });
    const record: LicenseRecord | null = row
      ? {
          status: row.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
          expiresAt: row.expiresAt,
          graceDays: row.graceDays,
          message: row.message,
        }
      : null;
    this.cache = { at: Date.now(), record };
    return record;
  }

  async currentState(now = new Date()): Promise<LicenseState> {
    return evaluateLicense(await this.getRecord(), now);
  }

  async setLicense(input: LicenseInput): Promise<LicenseState> {
    const data = {
      status: input.status,
      expiresAt: input.expiresAt,
      graceDays: input.graceDays,
      message: input.message,
    };
    await this.prisma.autopendLicense.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
    this.cache = null; // the change applies on the very next request
    return this.currentState();
  }

  /** Parses and bounds what the portal sends. Anything odd is refused rather than guessed at. */
  parseLicense(body: Record<string, unknown>): LicenseInput {
    const status = body.status;
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      throw new BadRequestException('status must be ACTIVE or SUSPENDED.');
    }
    let expiresAt: Date | null = null;
    if (body.expiresAt !== null && body.expiresAt !== undefined && body.expiresAt !== '') {
      expiresAt = new Date(String(body.expiresAt));
      if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('expiresAt is not a valid date.');
    }
    const graceDays = body.graceDays === undefined ? 3 : Number(body.graceDays);
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 60) {
      throw new BadRequestException('graceDays must be a whole number from 0 to 60.');
    }
    const message =
      typeof body.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 300) : null;
    return { status, expiresAt, graceDays, message };
  }

  // ---------------- numbers for the portal ----------------

  async stats(now = new Date()): Promise<AutopendStats> {
    const restaurant = await this.prisma.restaurant.findFirst({
      select: { name: true, timezone: true, currency: true },
    });
    const tz = restaurant?.timezone || 'Asia/Kolkata';
    const today = localDate(now, tz);
    const startToday = zonedDayStart(today, tz);
    const start7 = zonedDayStart(addDaysToDate(today, -6), tz);
    const start30 = zonedDayStart(addDaysToDate(today, -29), tz);

    const window = async (from: Date): Promise<WindowTotals> => {
      const [placed, paid] = await Promise.all([
        this.prisma.order.count({ where: { createdAt: { gte: from }, status: { not: 'CANCELLED' } } }),
        this.prisma.order.aggregate({
          where: { createdAt: { gte: from }, status: 'PAID' },
          _sum: { totalAmount: true },
        }),
      ]);
      return { orders: placed, revenue: (paid._sum.totalAmount ?? 0).toString() };
    };

    const [todayT, week, month, openNow, lastOrder, lastAudit, activeStaff, totalStaff, branches, tables, menuItems] =
      await Promise.all([
        window(startToday),
        window(start7),
        window(start30),
        this.prisma.order.count({ where: { status: { in: ['OPEN', 'BILLED'] } } }),
        this.prisma.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        this.prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count(),
        this.prisma.branch.count(),
        this.prisma.table.count(),
        this.prisma.menuItem.count(),
      ]);

    const last = [lastOrder?.createdAt, lastAudit?.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      version: process.env.APP_VERSION || 'dev',
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      now: now.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      restaurant: restaurant ?? null,
      orders: {
        today: todayT,
        last7Days: week,
        last30Days: month,
        openNow,
        lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
      },
      staff: { active: activeStaff, total: totalStaff },
      branches,
      tables,
      menuItems,
      lastActivityAt: last?.toISOString() ?? null,
      license: await this.currentState(now),
    };
  }
}
