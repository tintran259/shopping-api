import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ description: 'Nội dung tin nhắn (text thuần)' })
  @IsString()
  @MaxLength(8000)
  content: string;
}

export class ChatContextDto {
  @ApiPropertyOptional({
    description: 'Route BO người dùng đang xem, vd /orders',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;
}

export class ChatDto {
  @ApiProperty({
    type: [ChatMessageDto],
    description: 'Lịch sử hội thoại (FE giữ)',
  })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({ type: ChatContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;
}
