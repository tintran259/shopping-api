import { ProductSummaryDto } from '../../catalog/serializers/catalog.serializer';
import { Wishlist } from '../entities/wishlist.entity';

/**
 * Storefront-shaped wishlist: each item carries its server `id` (needed to
 * remove it) plus the full product summary so list pages render without a
 * refetch. Items whose product no longer exists are dropped.
 */
export interface WishlistItemDto {
  id: string;
  variantId: string | null;
  product: ProductSummaryDto;
}
export interface WishlistDto {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  items: WishlistItemDto[];
}

export function toWishlistDto(
  list: Wishlist,
  summaryById: Map<string, ProductSummaryDto>,
): WishlistDto {
  return {
    id: list.id,
    name: list.name,
    isDefault: list.isDefault,
    createdAt:
      list.createdAt instanceof Date
        ? list.createdAt.toISOString()
        : String(list.createdAt),
    items: (list.items ?? [])
      .map((it) => {
        const product = summaryById.get(it.productId);
        return product
          ? { id: it.id, variantId: it.variantId ?? null, product }
          : null;
      })
      .filter((x): x is WishlistItemDto => !!x),
  };
}
