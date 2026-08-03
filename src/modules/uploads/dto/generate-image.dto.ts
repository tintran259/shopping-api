import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class GenerateImageDto {
  @ApiProperty({
    description: 'Mô tả ảnh sản phẩm muốn tạo (tiếng Việt hoặc tiếng Anh)',
    example:
      'Ảnh sản phẩm mứt dâu Đà Lạt trong hũ thủy tinh, nền sáng, chụp studio',
  })
  @IsString()
  @Length(3, 1000)
  prompt: string;
}
