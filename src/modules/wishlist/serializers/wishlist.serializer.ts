import { ProductDto } from '../../catalog/serializers/catalog.serializer';
import { Wishlist } from '../entities/wishlist.entity';

/**
 * Storefront-shaped wishlist. Items can be variant-specific: `variantId` +
 * `variantLabel` identify the chosen variant, and the embedded `product` is
 * adjusted (price/thumbnail) to that variant so the list renders it directly.
 * Items whose product no longer exists are dropped.
 */
export interface WishlistItemDto {
  id: string;
  variantId: string | null;
  variantLabel: string | null;
  product: WishlistProduct;
}

interface WishlistProduct {
  id: string;
  slug: string;
  name: string;
  thumbnail: { url: string; alt: string };
  /** Cheapest/only variant — the add-to-cart target when the item pins no
   *  variant (the cart is variant-keyed, so a line without it can't sync). */
  defaultVariantId: string | null;
  price: { amount: number; compareAt: number | null; currency: string };
  priceVaries: boolean;
  brand: { id: string; slug: string; name: string } | null;
  rating?: { average: number; count: number };
  inStock: boolean;
  branchStock: { branchId: string; inStock: boolean; quantity: number }[];
  optionPreview?: { name: string; displayType: string; values: string[] };
}

export interface WishlistDto {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  items: WishlistItemDto[];
}

/** Reduce a full ProductDto (+ chosen variant) to the compact wishlist product. */
function toWishlistProduct(
  product: ProductDto,
  variant?: ProductDto['variants'][number],
): WishlistProduct {
  const [primary] = product.images;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    thumbnail: variant?.image ?? primary ?? { url: '', alt: product.name },
    defaultVariantId: product.defaultVariantId,
    price: variant?.price ?? product.price,
    priceVaries: variant ? false : product.priceVaries,
    brand: product.brand,
    rating: product.rating,
    inStock: variant
      ? variant.branchStock.some((b) => b.inStock)
      : product.inStock,
    branchStock: variant ? variant.branchStock : product.branchStock,
    optionPreview: product.optionPreview,
  };
}

const variantLabelOf = (
  variant?: ProductDto['variants'][number],
): string | null =>
  variant && Object.keys(variant.options).length
    ? Object.values(variant.options).join(' · ')
    : null;

export function toWishlistDto(
  list: Wishlist,
  productById: Map<string, ProductDto>,
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
        const product = productById.get(it.productId);
        if (!product) return null;
        const variant = it.variantId
          ? product.variants.find((v) => v.id === it.variantId)
          : undefined;
        return {
          id: it.id,
          variantId: it.variantId ?? null,
          variantLabel: variantLabelOf(variant),
          product: toWishlistProduct(product, variant),
        };
      })
      .filter((x): x is WishlistItemDto => !!x),
  };
}
