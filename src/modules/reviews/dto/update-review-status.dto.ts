import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReviewStatus } from '../../../common/enums';

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
