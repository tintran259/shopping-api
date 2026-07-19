import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReviewStatus } from '../../../common/enums';
import { Customer } from '../../customers/entities/customer.entity';
import { Product } from '../../catalog/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('reviews')
export class Review extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  /** Reuses the existing `product_id` column — admin moderation needs the
   *  product name/slug, storefront read/write paths never load it. */
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  /** Biến thể (order item) được đánh giá — mỗi item trong đơn là 1 review riêng.
   *  Null cho đánh giá không gắn biến thể (vd đánh giá tự do không qua đơn).
   *  `productId` vẫn giữ để gộp điểm ở cấp sản phẩm. */
  @ApiProperty({ required: false, format: 'uuid' })
  @Index()
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId?: string | null;

  /** Nhãn biến thể snapshot lúc đánh giá (vd "Trắng · L"); rỗng cho sản phẩm
   *  không có tùy chọn. Lưu sẵn để hiển thị không cần join ProductVariant. */
  @ApiProperty({ required: false })
  @Column({ name: 'variant_title', type: 'varchar', nullable: true })
  variantTitle?: string | null;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  /** Reuses the existing `customer_id` column — same reasoning as `product`. */
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Column({ type: 'int' })
  rating: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  title?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  body?: string;

  /** Phản hồi công khai của shop cho đánh giá (hiển thị kèm review trên
   *  storefront). Null = chưa phản hồi. */
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  reply?: string | null;

  @ApiProperty({ required: false })
  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt?: Date | null;

  @ApiProperty({ enum: ReviewStatus })
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @ApiProperty({ type: [String], default: [] })
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @ApiProperty({ type: [String], default: [] })
  @Column({ name: 'image_urls', type: 'text', array: true, default: [] })
  imageUrls: string[];

  @ApiProperty({ required: false, format: 'uuid', description: 'null = review not tied to a purchase' })
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId?: string;

  /** Set when the review was submitted from a delivered order — the source of
   *  the `verified` badge and the author name shown on the storefront. */
  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  /** Virtual (not persisted): a review is "verified" when it originates from a
   *  real purchase (has a linked order). */
  @ApiProperty({ description: 'True when tied to a purchased order' })
  get verified(): boolean {
    return this.orderId != null;
  }
}
