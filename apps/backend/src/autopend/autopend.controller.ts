import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AutopendKeyGuard } from './autopend-key.guard';
import { AutopendService } from './autopend.service';

// Not in the public API docs: these are for the AutoPend admin portal only.
@ApiExcludeController()
@Controller('v1')
export class AutopendController {
  constructor(private readonly service: AutopendService) {}

  /** The restaurant's numbers, for the portal's overview. Needs the AutoPend key. */
  @UseGuards(AutopendKeyGuard)
  @Get('autopend/stats')
  stats() {
    return this.service.stats();
  }

  @UseGuards(AutopendKeyGuard)
  @Get('autopend/license')
  async license() {
    return { record: await this.service.getRecord(), state: await this.service.currentState() };
  }

  /** The portal tells this restaurant whether it may keep working. Needs the AutoPend key. */
  @UseGuards(AutopendKeyGuard)
  @Put('autopend/license')
  async setLicense(@Body() body: Record<string, unknown>) {
    return { state: await this.service.setLicense(this.service.parseLicense(body ?? {})) };
  }

  /** For the banner in the app: any signed-in person can see whether the subscription needs attention. */
  @UseGuards(JwtAuthGuard)
  @Get('license-status')
  status() {
    return this.service.currentState();
  }
}
