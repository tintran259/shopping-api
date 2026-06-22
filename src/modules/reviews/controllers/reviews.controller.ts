import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { CreateReviewDto } from '../dto/review.dto';
import { ReviewsService } from '../services/reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'List published reviews for a product' })
  list(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.reviews.listPublished(productId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review (pending moderation)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, dto);
  }
}
