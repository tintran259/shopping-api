import { ComboStatus } from '../../../common/enums';
import { Combo } from '../entities/combo.entity';
import { isComboSellable, originalPriceOf } from './combo.serializer';

const DAY = 24 * 60 * 60 * 1000;

function makeCombo(overrides: Partial<Combo> = {}): Combo {
  return {
    id: 'c1',
    slug: 'combo',
    name: 'Combo',
    price: '100',
    status: ComboStatus.ACTIVE,
    startsAt: null,
    endsAt: null,
    branchId: null,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Combo;
}

describe('combo.serializer', () => {
  describe('isComboSellable', () => {
    const now = Date.now();

    it('bán được khi active và không giới hạn lịch', () => {
      expect(isComboSellable(makeCombo(), now)).toBe(true);
    });

    it('không bán khi trạng thái không phải active', () => {
      expect(
        isComboSellable(makeCombo({ status: ComboStatus.DRAFT }), now),
      ).toBe(false);
      expect(
        isComboSellable(makeCombo({ status: ComboStatus.INACTIVE }), now),
      ).toBe(false);
    });

    it('chưa tới ngày bắt đầu ⇒ chưa bán', () => {
      const combo = makeCombo({ startsAt: new Date(now + DAY) });
      expect(isComboSellable(combo, now)).toBe(false);
    });

    it('đã qua ngày kết thúc ⇒ ngừng bán', () => {
      const combo = makeCombo({ endsAt: new Date(now - DAY) });
      expect(isComboSellable(combo, now)).toBe(false);
    });

    it('trong khoảng lịch ⇒ bán được', () => {
      const combo = makeCombo({
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + DAY),
      });
      expect(isComboSellable(combo, now)).toBe(true);
    });
  });

  describe('originalPriceOf', () => {
    it('tổng giá lẻ = Σ price × quantity của thành phần', () => {
      const combo = makeCombo({
        items: [
          { variantId: 'v1', quantity: 2, variant: { price: '30' } },
          { variantId: 'v2', quantity: 1, variant: { price: '40' } },
        ] as never,
      });
      expect(originalPriceOf(combo)).toBe(100);
    });
  });
});
