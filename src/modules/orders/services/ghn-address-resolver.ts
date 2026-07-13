import { BadRequestException, Injectable } from '@nestjs/common';
import { GhnClient, GhnDistrict, GhnWard } from './ghn-client';

// Unicode combining diacritical marks (U+0300–U+036F), built from char codes
// rather than a literal regex range to avoid any source-encoding ambiguity.
const DIACRITICS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/** "Phường Ba Đình" → "phuong ba dinh" (bỏ dấu, thường hoá, bỏ tiền tố cấp
 *  hành chính) — so khớp lỏng tay với tên GHN trả về, vốn không hẳn giống
 *  100% cách viết trong `locations` module của hệ thống. */
function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^(phuong|xa|thi tran|quan|huyen|thanh pho|tinh)\s+/, '')
    .trim();
}

export interface GhnAddress {
  districtId: number;
  wardCode: string;
}

/**
 * Resolves a `provinceName`/`wardName` pair (this codebase's 2-tier VN
 * administrative model — no district) into the `district_id`/`ward_code`
 * pair GHN's own API still expects. Since we don't store a district
 * ourselves, this searches every district in the matched province for one
 * whose wards contain a name match — O(districts) GHN calls the first time
 * a given province is resolved, cached afterward (province/ward master data
 * changes rarely, if ever, within a running process).
 */
@Injectable()
export class GhnAddressResolver {
  private provincesCache?: Promise<
    { ProvinceID: number; ProvinceName: string }[]
  >;
  private districtsCache = new Map<number, Promise<GhnDistrict[]>>();
  private wardsCache = new Map<number, Promise<GhnWard[]>>();

  constructor(private readonly ghn: GhnClient) {}

  async resolve(provinceName: string, wardName: string): Promise<GhnAddress> {
    // Mock mode (no GHN_TOKEN): skip the real province/district/ward search
    // entirely — `GhnClient`'s own master-data calls would just return an
    // empty mock list anyway, and the fake IDs below are only ever fed back
    // into `GhnClient.createShippingOrder`, itself mocked in this mode too.
    if (this.ghn.isMockMode) {
      return { districtId: 0, wardCode: 'MOCK_WARD' };
    }

    const provinces = await this.getProvinces();
    const targetProvince = normalize(provinceName);
    const province = provinces.find(
      (p) => normalize(p.ProvinceName) === targetProvince,
    );
    if (!province) {
      throw new BadRequestException(
        `Không tìm thấy tỉnh/thành "${provinceName}" trên GHN`,
      );
    }

    const districts = await this.getDistricts(province.ProvinceID);
    const targetWard = normalize(wardName);
    for (const district of districts) {
      const wards = await this.getWards(district.DistrictID);
      const ward = wards.find((w) => normalize(w.WardName) === targetWard);
      if (ward)
        return { districtId: district.DistrictID, wardCode: ward.WardCode };
    }
    throw new BadRequestException(
      `Không tìm thấy phường/xã "${wardName}" trên GHN`,
    );
  }

  private getProvinces() {
    this.provincesCache ??= this.ghn.getProvinces();
    return this.provincesCache;
  }

  private getDistricts(provinceId: number) {
    let cached = this.districtsCache.get(provinceId);
    if (!cached) {
      cached = this.ghn.getDistricts(provinceId);
      this.districtsCache.set(provinceId, cached);
    }
    return cached;
  }

  private getWards(districtId: number) {
    let cached = this.wardsCache.get(districtId);
    if (!cached) {
      cached = this.ghn.getWards(districtId);
      this.wardsCache.set(districtId, cached);
    }
    return cached;
  }
}
