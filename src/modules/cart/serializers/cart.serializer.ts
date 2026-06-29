import {
  BranchStockDto,
  ProductDto,
} from '../../catalog/serializers/catalog.serializer';
import { CartItem } from '../entities/cart-item.entity';

/**
 * Storefront-shaped cart line — mirrors the FE `CartLine` (src/store/cart.store)
 * so the cart renders without a refetch. `id` is the cart-item id (the FE uses it
 * as the line key + the target for quantity/remove). Pricing/stock come from the
 * catalog `ProductDto` (variant-level), so they stay consistent with the PLP/PDP.
 */
export interface CartLineDto {
  id: string;
  variantId: string;
  slug: string;
  name: string;
  image: { url?: string; alt?: string };
  brand?: string;
  detail?: string;
  price: number;
  compareAt: number | null;
  currency: string;
  quantity: number;
  maxStock: number;
  branchStock: BranchStockDto[];
  rating?: { average: number; count: number };
}

export function toCartLine(item: CartItem, product: ProductDto): CartLineDto {
  const variant = product.variants.find((v) => v.id === item.variantId);
  const detail =
    variant && Object.keys(variant.options).length
      ? Object.entries(variant.options)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ')
      : undefined;
  return {
    id: item.id,
    variantId: item.variantId,
    slug: product.slug,
    name: product.name,
    image: variant?.image ??
      product.images[0] ?? { url: '', alt: product.name },
    brand: product.brand?.name,
    detail,
    price: variant?.price.amount ?? product.price.amount,
    compareAt: variant?.price.compareAt ?? product.price.compareAt,
    currency: product.currency,
    quantity: item.quantity,
    maxStock: variant?.stock ?? (product.inStock ? 99 : 0),
    branchStock: product.branchStock,
    rating: product.rating,
  };
}
