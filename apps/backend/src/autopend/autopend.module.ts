import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutopendController } from './autopend.controller';
import { AutopendKeyGuard } from './autopend-key.guard';
import { AutopendService } from './autopend.service';
import { LicenseEnforcementGuard } from './license-enforcement.guard';

// AutoPend hosting: reporting to, and obeying, the AutoPend admin portal. Does nothing on a server
// without AUTOPEND_ADMIN_KEY and without a licence record, so self-hosted installs are unaffected.
@Module({
  controllers: [AutopendController],
  providers: [AutopendService, AutopendKeyGuard, { provide: APP_GUARD, useClass: LicenseEnforcementGuard }],
  exports: [AutopendService],
})
export class AutopendModule {}
