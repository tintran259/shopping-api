import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '../../../common/enums';
import { CreateReviewDto } from '../dto/review.dto';
import { Review } from '../entities/review.entity';
import { ReviewsRepository } from '../repositories/reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(private readonly reviews: ReviewsRepository) {}

  listPublished(productId: string): Promise<Review[]> {
    return this.reviews.findPublishedByProduct(productId);
  }

  create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    return this.reviews.save(
      this.reviews.create({ ...dto, customerId, status: ReviewStatus.PENDING }),
    );
  }
}
