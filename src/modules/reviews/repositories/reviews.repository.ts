import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewStatus } from '../../../common/enums';
import { AdminReviewQueryDto } from '../dto/admin-review-query.dto';
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

  async findByIdOrThrow(id: string): Promise<Review> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  /** Admin moderation queue — product/customer joined for display, newest
   *  first (surfaces fresh submissions at the top of "chờ duyệt" first). */
  async searchAdmin(query: AdminReviewQueryDto): Promise<[Review[], number]> {
    const qb = this.repo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.product', 'product')
      .leftJoinAndSelect('review.customer', 'customer')
      .orderBy('review.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) qb.andWhere('review.status = :status', { status: query.status });
    if (query.q) {
      qb.andWhere(
        '(unaccent(product.name) ILIKE unaccent(:q) OR unaccent(review.title) ILIKE unaccent(:q) OR unaccent(review.body) ILIKE unaccent(:q))',
        { q: `%${query.q}%` },
      );
    }

    return qb.getManyAndCount();
  }
}
