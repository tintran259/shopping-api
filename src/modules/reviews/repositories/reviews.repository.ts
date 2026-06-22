import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewStatus } from '../../../common/enums';
import { Review } from '../entities/review.entity';

@Injectable()
export class ReviewsRepository {
  constructor(
    @InjectRepository(Review)
    private readonly repo: Repository<Review>,
  ) {}

  create(data: Partial<Review>): Review {
    return this.repo.create(data);
  }

  save(review: Review): Promise<Review> {
    return this.repo.save(review);
  }

  findPublishedByProduct(productId: string): Promise<Review[]> {
    return this.repo.find({
      where: { productId, status: ReviewStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
  }
}
