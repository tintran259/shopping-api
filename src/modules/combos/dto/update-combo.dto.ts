import { PartialType } from '@nestjs/swagger';
import { CreateComboDto } from './create-combo.dto';

/** Sửa combo — mọi field tùy chọn. Gửi `items` = thay toàn bộ thành phần. */
export class UpdateComboDto extends PartialType(CreateComboDto) {}
