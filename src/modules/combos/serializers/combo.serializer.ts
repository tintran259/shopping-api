import { ComboStatus } from '../../../common/enums';
import { Combo } from '../entities/combo.entity';

/** Combo có đang bán được không: active + trong khoảng lịch (startsAt..endsAt).
 *  Mốc trống = không giới hạn phía đó (bán vô thời hạn). */
export function isComboSellable(combo: Combo, now = Date.now()): boolean {
  if (combo.status !== ComboStatus.ACTIVE) return false;
  if (combo.startsAt && combo.startsAt.getTime() > now) return false;
  if (combo.endsAt && combo.endsAt.getTime() < now) return false;
  return true;
}

/** Ảnh đại diện của một variant (ảnh riêng, hoặc ảnh chính của sản phẩm). */
function variantImage(combo: Combo, itemIdx: number): string | undefined {
  const v = combo.items[itemIdx]?.variant;
  const product = v?.product;
  return (
    v?.imageUrl ??
    product?.images?.find((i) => i.isPrimary)?.url ??
    product?.images?.[0]?.url
  );
}

/** Tổng "giá gốc" nếu mua lẻ các thành phần (để tính % tiết kiệm). */
export function originalPriceOf(combo: Combo): number {
  return (combo.items ?? []).reduce(
    (sum, it) => sum + Number(it.variant?.price ?? 0) * it.quantity,
    0,
  );
}

/**
 * Shape combo trả cho client (BO + storefront): kèm thành phần rút gọn, giá gốc,
 * số tiền tiết kiệm và tồn khả dụng (ước tính, tính động — không lưu).
 */
export function toComboView(combo: Combo, availability: number) {
  const original = originalPriceOf(combo);
  const price = Number(combo.price);
  return {
    id: combo.id,
    slug: combo.slug,
    name: combo.name,
    description: combo.description ?? null,
    imageUrl: combo.imageUrl ?? null,
    price: combo.price,
    status: combo.status,
    startsAt: combo.startsAt ?? null,
    endsAt: combo.endsAt ?? null,
    branchId: combo.branchId ?? null,
    branchName: combo.branch?.name ?? null,
    itemCount: combo.items?.length ?? 0,
    originalPrice: original.toFixed(2),
    savings: Math.max(0, original - price).toFixed(2),
    availability,
    /** Đang bán được (active + trong lịch). */
    sellable: isComboSellable(combo),
    items: (combo.items ?? []).map((it, idx) => ({
      variantId: it.variantId,
      quantity: it.quantity,
      sku: it.variant?.sku ?? '',
      unitPrice: it.variant?.price ?? '0',
      productId: it.variant?.productId ?? null,
      productName: it.variant?.product?.name ?? '',
      productSlug: it.variant?.product?.slug ?? '',
      imageUrl: variantImage(combo, idx) ?? null,
    })),
  };
}
