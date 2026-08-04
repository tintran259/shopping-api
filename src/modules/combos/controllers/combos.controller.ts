import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CombosService } from '../services/combos.service';

/** Combo công khai cho storefront: chỉ combo đang bán (active). */
@ApiTags('combos')
@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách combo đang bán (kèm giá gốc/tiết kiệm/tồn)',
  })
  list() {
    return this.combos.findPublicList();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết combo theo slug' })
  bySlug(@Param('slug') slug: string) {
    return this.combos.findPublicBySlug(slug);
  }
}
