import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around GHN's (Giao Hàng Nhanh) public API v2 — request/response
 * shapes here are transcribed from GHN's own "Create Order" documentation
 * (https://api.ghn.vn/home/docs/detail?id=123), fetched directly rather than
 * guessed, though ⚠️ still not verified against a live sandbox/real account —
 * re-check before relying on this in production, docs can drift from the API.
 *
 * This codebase models Vietnam's 2025 2-tier administrative reform (province
 * → ward, no district), while GHN's own API still expects a `district_id`
 * internally — see `GhnAddressResolver` for how that's bridged.
 *
 * **Mock mode**: when `GHN_TOKEN` is unset, every method returns a canned
 * fake response instead of calling the real API — this lets the whole
 * create-shipment flow (incl. `GhnAddressResolver`, which checks
 * {@link isMockMode} and skips real province/district/ward lookups) be
 * exercised end-to-end with no credentials. The moment a real `GHN_TOKEN` is
 * set, this class calls the real API automatically — no other code change
 * needed to go live. Mock responses are always logged loudly and tracking
 * codes are prefixed `MOCK-GHN-` so they can never be mistaken for a real
 * shipment.
 */
export interface GhnProvince {
  ProvinceID: number;
  ProvinceName: string;
}

export interface GhnDistrict {
  DistrictID: number;
  ProvinceID: number;
  DistrictName: string;
}

export interface GhnWard {
  WardCode: string;
  DistrictID: number;
  WardName: string;
}

export interface GhnCreateOrderItem {
  name: string;
  /** Our SKU — GHN's `code` field. */
  code?: string;
  quantity: number;
  /** Unit price — GHN's `price` field (optional on their side). */
  price?: number;
  weight: number;
}

export interface GhnCreateOrderPayload {
  /** Sender — optional, GHN defaults to the shop's own registered address
   *  (configured in their merchant dashboard against `ShopId`) if omitted;
   *  we still send name/phone/address for clarity on GHN's side, but not
   *  ward/district (we don't keep a GHN-specific pickup ward/district per
   *  branch the way we do for GHTK — the `ShopId` header already carries
   *  that). */
  from_name?: string;
  from_phone?: string;
  from_address?: string;
  to_name: string;
  to_phone: string;
  to_address: string;
  to_ward_code: string;
  to_district_id: number;
  weight: number;
  /** Package dimensions (cm) — GHN requires these alongside weight; we have
   *  no per-product dimension data anywhere in this system, so a fixed
   *  placeholder is used (see `DEFAULT_PACKAGE_*_CM` in `ghn.service.ts`),
   *  same fallback spirit as the item-weight default. */
  length: number;
  width: number;
  height: number;
  service_type_id: number;
  payment_type_id: number;
  required_note: string;
  cod_amount?: number;
  /** Declared value for insurance/claims. */
  insurance_value?: number;
  content?: string;
  note?: string;
  items: GhnCreateOrderItem[];
  /** Our own order code, for reconciliation on GHN's side (their dashboard/support). */
  client_order_code?: string;
}

export interface GhnCreateOrderResponse {
  order_code: string;
  sort_code?: string;
  trans_type?: string;
  ward_encode?: string;
  district_encode?: string;
  total_fee: number;
  fee?: {
    main_service: number;
    insurance?: number;
    coupon?: number;
    r2s?: number;
    return?: number;
    station_do?: number;
    station_pu?: number;
  };
  expected_delivery_time?: string;
}

@Injectable()
export class GhnClient {
  private readonly logger = new Logger(GhnClient.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('ghn.baseUrl') ?? '';
    this.token = config.get<string>('ghn.token') ?? '';
  }

  /** No `GHN_TOKEN` configured — every call returns a mock response instead
   *  of hitting the real API. Checked by `GhnAddressResolver` too, so it can
   *  skip real province/district/ward lookups in the same mode. */
  get isMockMode(): boolean {
    return !this.token;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; shopId?: string } = {},
  ): Promise<T> {
    if (this.isMockMode) {
      return this.mockResponse<T>(path, options.body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        Token: this.token,
        ...(options.shopId ? { ShopId: options.shopId } : {}),
      },
      body: JSON.stringify(options.body ?? {}),
    });
    const json = (await res.json().catch(() => null)) as {
      code?: number;
      message?: string;
      data?: T;
    } | null;
    if (!res.ok || !json || json.code !== 200) {
      throw new BadGatewayException(
        `GHN API lỗi (${path}): ${json?.message ?? res.statusText}`,
      );
    }
    return json.data as T;
  }

  private mockResponse<T>(path: string, body: unknown): T {
    this.logger.warn(
      `[MOCK] GHN_TOKEN chưa cấu hình — trả về dữ liệu giả cho ${path}. ` +
        'Đặt GHN_TOKEN thật để gọi API thật, không cần sửa code.',
    );
    if (path === '/v2/shipping-order/create') {
      return {
        order_code: `MOCK-GHN-${Date.now()}`,
        sort_code: 'MOCK-SORT-01',
        trans_type: 'truck',
        ward_encode: 'MOCK_WARD_ENC',
        district_encode: 'MOCK_DISTRICT_ENC',
        total_fee: 25000,
        fee: { main_service: 22000, insurance: 3000 },
        expected_delivery_time: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      } as T;
    }
    // Master-data endpoints (getProvinces/getDistricts/getWards) aren't
    // actually reached in mock mode — `GhnAddressResolver` short-circuits on
    // `isMockMode` before calling them — but return a harmless empty list
    // rather than throwing, in case something ever calls them directly.
    void body;
    return [] as T;
  }

  getProvinces(): Promise<GhnProvince[]> {
    return this.request('/master-data/province');
  }

  getDistricts(provinceId: number): Promise<GhnDistrict[]> {
    return this.request('/master-data/district', {
      body: { province_id: provinceId },
    });
  }

  getWards(districtId: number): Promise<GhnWard[]> {
    return this.request('/master-data/ward', {
      body: { district_id: districtId },
    });
  }

  createShippingOrder(
    shopId: string,
    payload: GhnCreateOrderPayload,
  ): Promise<GhnCreateOrderResponse> {
    return this.request('/v2/shipping-order/create', { body: payload, shopId });
  }
}
