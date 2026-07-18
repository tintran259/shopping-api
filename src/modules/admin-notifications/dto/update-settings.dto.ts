import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { NotificationType } from '../../../common/enums';

export class NotificationSettingItemDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class UpdateNotificationSettingsDto {
  @ApiProperty({ type: [NotificationSettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationSettingItemDto)
  settings: NotificationSettingItemDto[];
}
