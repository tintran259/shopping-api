import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewStatus } from '../../../common/enums';
import {
  AdminReviewQueryDto,
  ReviewStats,
} from '../dto/admin-review-query.dto';
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

  saveAll(reviews: Review[]): Promise<Review[]> {
    return this.repo.save(reviews);
  }

  findPublishedByProduct(productId: string): Promise<Review[]> {
    return this.repo.find({
      where: { productId, status: ReviewStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
  }

  /** Storefront review list for a product — published only, newest first,
   *  paginated. Joins the review's customer (author name) and its source order
   *  (recipient-name fallback + `verified` badge) for the masked-author display. */
  findPublishedByProductPaged(
    productId: string,
    skip: number,
    take: number,
    star?: number,
  ): Promise<[Review[], number]> {
    const qb = this.repo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.customer', 'customer')
      .leftJoinAndSelect('review.order', 'order')
      .where('review.productId = :productId', { productId })
      .andWhere('review.status = :status', { status: ReviewStatus.PUBLISHED });

    if (star != null) {
      qb.andWhere('review.rating = :star', { star });
    }

    return qb
      .orderBy('review.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  /** Star histogram for a product (published only). Returns only the stars that
   *  actually have reviews — the service fills the 5→1 gaps with zeroes. */
  getDistribution(productId: string): Promise<{ rating: number; count: number }[]> {
    return this.repo.query(
      `SELECT rating, COUNT(*)::int AS count
         FROM reviews
        WHERE product_id = $1 AND status = $2
        GROUP BY rating`,
      [productId, ReviewStatus.PUBLISHED],
    );
  }

  /** Reviews already tied to an order — used to enforce one-review-per-order. */
  findByOrderId(orderId: string): Promise<Review[]> {
    return this.repo.find({ where: { orderId } });
  }

  /** Recompute a product's cached rating_avg/rating_count from its PUBLISHED
   *  reviews in a single statement (UPDATE … FROM subquery) so concurrent
   *  moderation actions can't interleave a stale read-modify-write. When a
   *  product has no published reviews the subquery yields (NULL, 0) → resets
   *  the cache to 0/0. */
  async recalculateProductRating(productId: string): Promise<void> {
    await this.repo.query(
      `UPDATE products p
          SET rating_avg = COALESCE(sub.avg, 0),
              rating_count = COALESCE(sub.cnt, 0)
         FROM (
           SELECT AVG(rating)::numeric(3, 2) AS avg, COUNT(*)::int AS cnt
             FROM reviews
            WHERE product_id = $1 AND status = $2
         ) sub
        WHERE p.id = $1`,
      [productId, ReviewStatus.PUBLISHED],
    );
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

    if (query.status)
      qb.andWhere('review.status = :status', { status: query.status });
    if (query.rating)
      qb.andWhere('review.rating = :rating', { rating: query.rating });
    if (query.q) {
      qb.andWhere(
        '(unaccent(product.name) ILIKE unaccent(:q) OR unaccent(review.title) ILIKE unaccent(:q) OR unaccent(review.body) ILIKE unaccent(:q))',
        { q: `%${query.q}%` },
      );
    }

    return qb.getManyAndCount();
  }

  /** Đếm theo trạng thái + điểm trung bình (cho thẻ tổng quan trang duyệt). */
  async getStats(): Promise<ReviewStats> {
    const rows: { status: ReviewStatus; count: string }[] = await this.repo
      .createQueryBuilder('review')
      .select('review.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('review.status')
      .getRawMany();
    const avg: { average: string | null } | undefined = await this.repo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .getRawOne();

    const stats: ReviewStats = {
      pending: 0,
      published: 0,
      rejected: 0,
      total: 0,
      average: avg?.average
        ? Math.round(Number(avg.average) * 10) / 10
        : 0,
    };
    for (const row of rows) {
      const n = Number(row.count);
      stats[row.status] = n;
      stats.total += n;
    }
    return stats;
  }
}
