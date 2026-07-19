import { ConflictException, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { ReviewStatus } from '../../../common/enums';
import {
  AdminReviewQueryDto,
  ReviewStats,
} from '../dto/admin-review-query.dto';
import { CreateReviewDto, SubmitOrderReviewDto } from '../dto/review.dto';
import { Review } from '../entities/review.entity';
import { ReviewsRepository } from '../repositories/reviews.repository';

/** Storefront-facing review row (FE contract — see products/:slug/reviews). */
export interface PublicReviewDto {
  id: string;
  rating: number;
  tags: string[];
  comment?: string;
  imageUrls: string[];
  authorName: string;
  createdAt: string;
  verified: boolean;
  /** Phản hồi công khai của shop (nếu có). */
  reply?: string;
  repliedAt?: string;
}

export interface ProductReviewsDto {
  reviews: PublicReviewDto[];
  total: number;
  average: number;
  distribution: { star: number; count: number }[];
}

@Injectable()
export class ReviewsService {
  constructor(private readonly reviews: ReviewsRepository) {}

  listPublished(productId: string): Promise<Review[]> {
    return this.reviews.findPublishedByProduct(productId);
  }

  create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    const { comment, ...rest } = dto;
    return this.reviews.save(
      this.reviews.create({
        ...rest,
        body: comment,
        tags: dto.tags ?? [],
        imageUrls: dto.imageUrls ?? [],
        customerId,
        status: ReviewStatus.PENDING,
      }),
    );
  }

  /** Storefront review block for a product: paginated published reviews +
   *  aggregate (total, average to 1 decimal, full 5→1 star distribution). */
  async getProductReviews(
    productId: string,
    page: number,
    limit: number,
    star?: number,
  ): Promise<ProductReviewsDto> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.reviews.findPublishedByProductPaged(
      productId,
      skip,
      limit,
      star,
    );
    const distRows = await this.reviews.getDistribution(productId);

    const counts = new Map(distRows.map((r) => [Number(r.rating), r.count]));
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts.get(star) ?? 0,
    }));

    const totalCount = distribution.reduce((s, d) => s + d.count, 0);
    const weighted = distribution.reduce((s, d) => s + d.star * d.count, 0);
    const average =
      totalCount > 0 ? Math.round((weighted / totalCount) * 10) / 10 : 0;

    return {
      reviews: rows.map((r) => this.toPublicReview(r)),
      total,
      average,
      distribution,
    };
  }

  /** Create one PENDING, verified review per rated order item.
   *  `items` carries the resolved productId/variantId; `reviewMap` carries the
   *  per-item rating/tags/comment/images keyed by variantId. Items not present
   *  in the map (customer chose to skip) are silently ignored. */
  async submitFromOrder(params: {
    orderId: string;
    customerId: string;
    items: {
      productId: string;
      variantId: string;
      variantTitle?: string;
      rating: number;
      tags?: string[];
      comment?: string;
      imageUrls?: string[];
    }[];
  }): Promise<Review[]> {
    const { orderId, customerId, items } = params;

    const existing = await this.reviews.findByOrderId(orderId);
    if (existing.length) {
      throw new ConflictException('Bạn đã đánh giá đơn hàng này rồi');
    }

    const toCreate = items.map((item) =>
      this.reviews.create({
        productId: item.productId,
        variantId: item.variantId,
        variantTitle: item.variantTitle || null,
        customerId,
        orderId,
        rating: item.rating,
        tags: item.tags ?? [],
        body: item.comment,
        imageUrls: item.imageUrls ?? [],
        status: ReviewStatus.PENDING,
      }),
    );
    return this.reviews.saveAll(toCreate);
  }

  async findAllAdmin(
    query: AdminReviewQueryDto,
  ): Promise<PaginatedResult<Review>> {
    const [data, total] = await this.reviews.searchAdmin(query);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Thẻ tổng quan: đếm theo trạng thái + điểm trung bình. */
  getStats(): Promise<ReviewStats> {
    return this.reviews.getStats();
  }

  /** Approve/hide — any transition is allowed both ways (a mis-click on
   *  either side is just one more click to fix, not a one-way gate). The
   *  product's cached rating is recomputed whenever the published set changes. */
  async updateStatus(id: string, status: ReviewStatus): Promise<Review> {
    const review = await this.reviews.findByIdOrThrow(id);
    const previous = review.status;
    review.status = status;
    const saved = await this.reviews.save(review);
    if (previous !== status) {
      await this.reviews.recalculateProductRating(review.productId);
    }
    return saved;
  }

  /** [admin] Phản hồi công khai cho đánh giá. Chuỗi rỗng ⇒ xóa phản hồi. */
  async replyToReview(id: string, reply: string): Promise<Review> {
    const review = await this.reviews.findByIdOrThrow(id);
    const trimmed = reply.trim();
    review.reply = trimmed || null;
    review.repliedAt = trimmed ? new Date() : null;
    return this.reviews.save(review);
  }

  /** Masked author name for public display.
   *  "Nguyễn Văn An" → "Nguyễn V***", "Tin Tran" → "Tin T***",
   *  single word → unchanged. */
  private maskName(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return words[0] ?? '';
    return `${words[0]} ${words[1].charAt(0)}***`;
  }

  private authorName(review: Review): string {
    const c = review.customer;
    const full = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
    const raw = full || review.order?.recipientName || 'Ẩn danh';
    return this.maskName(raw);
  }

  private toPublicReview(review: Review): PublicReviewDto {
    return {
      id: review.id,
      rating: review.rating,
      tags: review.tags ?? [],
      comment: review.body ?? undefined,
      imageUrls: review.imageUrls ?? [],
      authorName: this.authorName(review),
      createdAt: review.createdAt.toISOString(),
      verified: review.verified,
      reply: review.reply ?? undefined,
      repliedAt: review.repliedAt?.toISOString(),
    };
  }
}
