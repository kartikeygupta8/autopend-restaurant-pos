import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AutopendService } from './autopend.service';
import { isAllowedWhileReadOnly } from './license-state';

/**
 * When the AutoPend subscription is suspended or has run out (and the grace days are over), everything that
 * changes the restaurant is refused with HTTP 402. Reading, exporting and signing in keep working, so the owner
 * can see why and take their data. A server the portal does not manage has no licence record and is never touched.
 */
@Injectable()
export class LicenseEnforcementGuard implements CanActivate {
  private readonly log = new Logger(LicenseEnforcementGuard.name);

  constructor(private readonly service: AutopendService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (isAllowedWhileReadOnly(req.method, req.originalUrl ?? req.url)) return true; // most requests stop here, no lookup

    let state;
    try {
      state = await this.service.currentState();
    } catch (e) {
      // If the licence cannot be read, the restaurant keeps trading. A broken lookup must never stop a till.
      this.log.error(`Could not read the licence, allowing the request: ${e instanceof Error ? e.message : e}`);
      return true;
    }
    if (!state.readOnly) return true;
    throw new HttpException(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, code: 'LICENSE_INACTIVE', message: state.message },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
