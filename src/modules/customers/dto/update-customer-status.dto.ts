import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CustomerStatus } from '../../../common/enums';

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: CustomerStatus })
  @IsEnum(CustomerStatus)
  status: CustomerStatus;
}
