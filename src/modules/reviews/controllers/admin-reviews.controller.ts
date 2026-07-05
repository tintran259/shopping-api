import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminReviewQueryDto } from '../dto/admin-review-query.dto';
import { UpdateReviewStatusDto } from '../dto/update-review-status.dto';
import { ReviewsService } from '../services/reviews.service';

/** Back-office review moderation — every route requires an admin (guarded at
 *  the class level). Public read/submit stay on `ReviewsController`. */
@ApiTags('admin/reviews')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(CustomerRole.ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews — filter by status, search (q), paginated' })
  findAll(@Query() query: AdminReviewQueryDto) {
    return this.reviews.findAllAdmin(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Approve (published) or hide (rejected) a review' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.updateStatus(id, dto.status);
  }
}
