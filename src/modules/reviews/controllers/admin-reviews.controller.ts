import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AdminReviewQueryDto } from '../dto/admin-review-query.dto';
import { UpdateReviewStatusDto } from '../dto/update-review-status.dto';
import { ReviewsService } from '../services/reviews.service';

/** Back-office review moderation — every route requires an admin (guarded at
 *  the class level). Public read/submit stay on `ReviewsController`. */
@ApiTags('admin/reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermission('reviews.view')
  @ApiOperation({
    summary: 'List reviews — filter by status, search (q), paginated',
  })
  findAll(@Query() query: AdminReviewQueryDto) {
    return this.reviews.findAllAdmin(query);
  }

  @Patch(':id/status')
  @RequirePermission('reviews.update')
  @ApiOperation({ summary: 'Approve (published) or hide (rejected) a review' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.updateStatus(id, dto.status);
  }
}
