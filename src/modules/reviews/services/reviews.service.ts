import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { ReviewStatus } from '../../../common/enums';
import { AdminReviewQueryDto } from '../dto/admin-review-query.dto';
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

  async findAllAdmin(query: AdminReviewQueryDto): Promise<PaginatedResult<Review>> {
    const [data, total] = await this.reviews.searchAdmin(query);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Approve/hide — any transition is allowed both ways (a mis-click on
   *  either side is just one more click to fix, not a one-way gate). */
  async updateStatus(id: string, status: ReviewStatus): Promise<Review> {
    const review = await this.reviews.findByIdOrThrow(id);
    review.status = status;
    return this.reviews.save(review);
  }
}
