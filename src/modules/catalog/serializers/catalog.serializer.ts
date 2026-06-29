import { InventoryStatus, ProductStatus } from '../../../common/enums';
import { Inventory } from '../../branches/entities/inventory.entity';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ProductVariant } from '../entities/product-variant.entity';

/**
 * Maps catalog entities → the shapes the storefront consumes (its
 * `src/types/product.ts`). Inventory (per variant × branch) is folded into
 * product-level `branchStock` + per-variant `stock` so the FE branch-availability
 * features work. Pure functions — pass pre-fetched inventory in to avoid N+1.
 */

export interface BranchStockDto {
  branchId: string;
  inStock: boolean;
  quantity: number;
}
interface PriceDto {
  amount: number;
  compareAt: number | null;
  currency: string;
}
interface ImageDto {
  url: string;
  alt: string;
}
interface OptionPreviewDto {
  name: string;
  displayType: string;
  values: string[];
}

export interface FacetOptionDto {
  value: string;
  label: string;
  count: number;
}
export interface FacetDto {
  key: string;
  label: string;
  type: 'checkbox' | 'swatch' | 'range' | 'rating';
  options: FacetOptionDto[];
}

export interface ProductSummaryDto {
  id: string;
  slug: string;
  name: string;
  thumbnail: ImageDto;
  /** Cheapest/only variant — the target for quick-add (cart needs a variant). */
  defaultVariantId: string | null;
  price: PriceDto;
  priceVaries: boolean;
  brand: { id: string; slug: string; name: string } | null;
  rating?: { average: number; count: number };
  flags: Record<string, boolean>;
  inStock: boolean;
  branchStock: BranchStockDto[];
  status: ProductStatus;
  optionPreview?: OptionPreviewDto;
}

export interface ProductDto extends Omit<ProductSummaryDto, 'thumbnail'> {
  sku: string;
  images: ImageDto[];
  shortDescription?: string;
  description?: string;
  attributes: {
    key: string;
    label: string;
    value: string | string[];
    group?: string;
  }[];
  options: {
    id: string;
    name: string;
    values: string[];
    displayType: string;
  }[];
  variants: {
    id: string;
    sku: string;
    options: Record<string, string>;
    price: PriceDto;
    stock: number;
    image?: ImageDto;
  }[];
  categories: { id: string; slug: string; name: string }[];
  currency: string;
  seo?: Record<string, unknown>;
}

const num = (s?: string | null): number => (s == null ? 0 : Number(s));
const available = (s: ProductStatus) =>
  s === ProductStatus.ACTIVE || s === ProductStatus.PREORDER;

/** variantId → its inventory rows. */
export type InventoryMap = Map<string, Inventory[]>;

export function indexInventory(rows: Inventory[]): InventoryMap {
  const map: InventoryMap = new Map();
  for (const r of rows) {
    const list = map.get(r.variantId) ?? [];
    list.push(r);
    map.set(r.variantId, list);
  }
  return map;
}

const variantStock = (v: ProductVariant, inv: InventoryMap): number =>
  (inv.get(v.id) ?? []).reduce((sum, r) => sum + r.quantity, 0);

function branchStockOf(
  variants: ProductVariant[],
  inv: InventoryMap,
): BranchStockDto[] {
  const byBranch = new Map<string, { quantity: number; inStock: boolean }>();
  for (const v of variants) {
    for (const r of inv.get(v.id) ?? []) {
      const e = byBranch.get(r.branchId) ?? { quantity: 0, inStock: false };
      e.quantity += r.quantity;
      if (r.quantity > 0 || r.status === InventoryStatus.PREORDER)
        e.inStock = true;
      byBranch.set(r.branchId, e);
    }
  }
  return [...byBranch].map(([branchId, e]) => ({ branchId, ...e }));
}

const pickImage = (images?: ProductImage[]): ImageDto => {
  const img = images?.find((i) => i.isPrimary) ?? images?.[0];
  return { url: img?.url ?? '', alt: img?.alt ?? '' };
};

const sortedOptions = (p: Product) =>
  [...(p.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

function cheapestVariant(
  variants: ProductVariant[],
): ProductVariant | undefined {
  if (!variants.length) return undefined;
  return variants.reduce((a, b) => (num(a.price) <= num(b.price) ? a : b));
}

function priceOf(p: Product, variants: ProductVariant[]): PriceDto {
  const cheapest = cheapestVariant(variants);
  if (cheapest) {
    return {
      amount: num(cheapest.price),
      compareAt:
        cheapest.compareAtPrice != null ? num(cheapest.compareAtPrice) : null,
      currency: p.currency,
    };
  }
  return {
    amount: num(p.basePrice),
    compareAt: p.compareAtPrice != null ? num(p.compareAtPrice) : null,
    currency: p.currency,
  };
}

export function toProductSummary(
  p: Product,
  inv: InventoryMap,
): ProductSummaryDto {
  const variants = p.variants ?? [];
  const branchStock = branchStockOf(variants, inv);
  const prices = variants.map((v) => num(v.price));
  const opt = sortedOptions(p)[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    thumbnail: pickImage(p.images),
    defaultVariantId: cheapestVariant(variants)?.id ?? null,
    price: priceOf(p, variants),
    priceVaries: new Set(prices).size > 1,
    brand: p.brand
      ? { id: p.brand.id, slug: p.brand.slug, name: p.brand.name }
      : null,
    rating:
      p.ratingCount > 0
        ? { average: num(p.ratingAvg), count: p.ratingCount }
        : undefined,
    flags: (p.flags ?? {}) as Record<string, boolean>,
    inStock: branchStock.length
      ? branchStock.some((b) => b.inStock)
      : available(p.status),
    branchStock,
    status: p.status,
    optionPreview: opt
      ? {
          name: opt.name,
          displayType: opt.displayType,
          values: [...(opt.values ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((v) => v.value),
        }
      : undefined,
  };
}

export function toProduct(p: Product, inv: InventoryMap): ProductDto {
  const variants = p.variants ?? [];
  const summary = toProductSummary(p, inv);

  // valueId → "OptionName" + value, to rebuild each variant's { optionName: value }.
  const valueLookup = new Map<string, { name: string; value: string }>();
  for (const o of p.options ?? []) {
    for (const v of o.values ?? [])
      valueLookup.set(v.id, { name: o.name, value: v.value });
  }

  return {
    ...summary,
    sku: variants[0]?.sku ?? '',
    currency: p.currency,
    images: (p.images ?? []).map((i) => ({ url: i.url, alt: i.alt ?? '' })),
    shortDescription: p.shortDescription,
    description: p.description,
    attributes: (p.attributes ?? []).map((a) => ({
      key: a.key,
      label: a.label,
      value: a.value,
      group: a.group,
    })),
    options: sortedOptions(p).map((o) => ({
      id: o.id,
      name: o.name,
      displayType: o.displayType,
      values: [...(o.values ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.value),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      options: Object.fromEntries(
        (v.optionValues ?? [])
          .map((ov) => valueLookup.get(ov.id))
          .filter((x): x is { name: string; value: string } => !!x)
          .map((x) => [x.name, x.value]),
      ),
      price: {
        amount: num(v.price),
        compareAt: v.compareAtPrice != null ? num(v.compareAtPrice) : null,
        currency: p.currency,
      },
      stock: variantStock(v, inv),
      image: v.imageUrl ? { url: v.imageUrl, alt: p.name } : undefined,
    })),
    categories: (p.categories ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
    })),
    seo: p.seo,
  };
}
