import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminReviewsController } from './controllers/admin-reviews.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { Review } from './entities/review.entity';
import { ReviewsRepository } from './repositories/reviews.repository';
import { ReviewsService } from './services/reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
