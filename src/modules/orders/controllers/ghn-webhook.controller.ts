import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { GHN_STATUS_MAP } from '../carrier-status-maps';
import { ShipmentsService } from '../services/shipments.service';

/**
 * GHN calls this URL (configured in their merchant dashboard, not in our
 * code) whenever a shipment's status changes. No auth header of ours applies
 * here — it's GHN's own server calling us, not an admin — so this route is
 * intentionally `@Public()`. The payload has many more fields than we read
 * (CODAmount, ShopID, Time, Type, Reason, ...); accepting a plain object
 * rather than a whitelisted DTO avoids rejecting the request over fields we
 * don't model. Exact field names/casing are GHN's documented convention as
 * best understood — re-verify against a real callback once this URL is
 * registered with GHN.
 */
@ApiTags('webhooks')
@Controller('webhooks/ghn')
export class GhnWebhookController {
  private readonly logger = new Logger(GhnWebhookController.name);

  constructor(private readonly shipments: ShipmentsService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'GHN shipment status callback (public, called by GHN itself)',
  })
  async handle(@Body() payload: Record<string, unknown>) {
    const orderCode = payload.OrderCode;
    const status = payload.Status;
    if (typeof orderCode !== 'string' || typeof status !== 'string') {
      throw new BadRequestException(
        'Thiếu OrderCode/Status trong payload webhook GHN',
      );
    }

    const found = await this.shipments.handleCarrierUpdate(
      orderCode,
      status,
      GHN_STATUS_MAP,
    );
    if (!found) {
      this.logger.warn(
        `GHN webhook: no shipment matches order code "${orderCode}"`,
      );
    }
    // GHN only needs a 2xx to stop retrying — body content doesn't matter to it.
    return { received: true };
  }
}
