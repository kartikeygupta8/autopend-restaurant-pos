import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const MIN_KEY_LENGTH = 32;

/**
 * Lets the AutoPend admin portal (and only it) read this restaurant's numbers and set its licence.
 * The key is set per restaurant by AutoPend when it deploys the restaurant (AUTOPEND_ADMIN_KEY).
 * If the variable is not set (every self-hosted install), these routes do not exist at all.
 */
@Injectable()
export class AutopendKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const want = (process.env.AUTOPEND_ADMIN_KEY ?? '').trim();
    if (want.length < MIN_KEY_LENGTH) throw new NotFoundException();
    const given = String(context.switchToHttp().getRequest<Request>().headers['x-autopend-key'] ?? '');
    // Hash both sides so the comparison always takes the same time, whatever the length of what was sent.
    const a = createHash('sha256').update(given).digest();
    const b = createHash('sha256').update(want).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException('Wrong key.');
    return true;
  }
}
