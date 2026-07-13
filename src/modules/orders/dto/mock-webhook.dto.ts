import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Testing helper — simulates the carrier's own webhook calling us, without
 *  needing a real account or a public callback URL (GHN/GHTK can't reach
 *  localhost). See `ShipmentsService.simulateCarrierWebhook`. */
export class MockWebhookDto {
  @ApiProperty({
    example: 'delivering',
    description:
      'The carrier\'s raw status value, e.g. GHN\'s "delivering" or GHTK\'s "4"',
  })
  @IsString()
  carrierStatus: string;
}
