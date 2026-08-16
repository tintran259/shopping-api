import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicComboQueryDto } from '../dto/public-combo-query.dto';
import { CombosService } from '../services/combos.service';

/** Combo công khai cho storefront: chỉ combo đang bán (active). */
@ApiTags('combos')
@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Danh sách combo đang bán (phân trang, lọc theo chi nhánh) — kèm giá ' +
      'gốc/tiết kiệm/tồn',
  })
  list(@Query() query: PublicComboQueryDto) {
    return this.combos.findPublicList(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết combo theo slug' })
  bySlug(@Param('slug') slug: string) {
    return this.combos.findPublicBySlug(slug);
  }
}
