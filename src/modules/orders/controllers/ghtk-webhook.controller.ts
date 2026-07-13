import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { GHTK_STATUS_MAP } from '../carrier-status-maps';
import { ShipmentsService } from '../services/shipments.service';

/**
 * GHTK calls this URL (registered with GHTK, not in our code) whenever a
 * shipment's status changes. No auth of ours applies — it's GHTK's own
 * server calling us — so this route is `@Public()`. Accepts a plain object
 * rather than a whitelisted DTO for the same reason as the GHN webhook: the
 * global `ValidationPipe`'s `forbidNonWhitelisted: true` would otherwise
 * reject the payload over fields we don't model.
 *
 * GHTK's docs (https://api.ghtk.vn/docs/submit-order/webhook/) state HTTP
 * 200 is the only response they treat as success — anything else triggers a
 * retry — hence the explicit `@HttpCode(200)` (Nest defaults POST to 201).
 */
@ApiTags('webhooks')
@Controller('webhooks/ghtk')
export class GhtkWebhookController {
  private readonly logger = new Logger(GhtkWebhookController.name);

  constructor(private readonly shipments: ShipmentsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'GHTK shipment status callback (public, called by GHTK itself)',
  })
  async handle(@Body() payload: Record<string, unknown>) {
    const labelId = payload.label_id;
    const statusId = payload.status_id;
    if (typeof labelId !== 'string' && typeof labelId !== 'number') {
      throw new BadRequestException(
        'Thiếu label_id trong payload webhook GHTK',
      );
    }
    if (typeof statusId !== 'string' && typeof statusId !== 'number') {
      throw new BadRequestException(
        'Thiếu status_id trong payload webhook GHTK',
      );
    }

    const found = await this.shipments.handleCarrierUpdate(
      String(labelId),
      String(statusId),
      GHTK_STATUS_MAP,
    );
    if (!found) {
      this.logger.warn(
        `GHTK webhook: no shipment matches label_id "${String(labelId)}"`,
      );
    }
    return { received: true };
  }
}
