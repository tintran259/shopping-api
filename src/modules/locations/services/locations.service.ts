import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Province } from '../entities/province.entity';
import { Ward } from '../entities/ward.entity';
import { LocationsRepository } from '../repositories/locations.repository';

/** Newest (2025) 2-tier administrative data — provinces → wards. */
const OPEN_API_TREE = 'https://provinces.open-api.vn/api/v2/?depth=2';

interface ApiProvince {
  code: number;
  name: string;
  division_type?: string;
  codename?: string;
  phone_code?: number;
  wards?: ApiWard[];
}
interface ApiWard {
  code: number;
  name: string;
  division_type?: string;
  codename?: string;
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private readonly locations: LocationsRepository) {}

  listProvinces(): Promise<Province[]> {
    return this.locations.findAllProvinces();
  }

  async listWards(provinceCode: number): Promise<Ward[]> {
    if (!(await this.locations.findProvince(provinceCode))) {
      throw new NotFoundException('Province not found');
    }
    return this.locations.findWardsByProvince(provinceCode);
  }

  /** Resolve + validate a (province, ward) pair for address creation. */
  async resolve(
    provinceCode: number,
    wardCode: number,
  ): Promise<{ province: Province; ward: Ward }> {
    const province = await this.locations.findProvince(provinceCode);
    if (!province) throw new NotFoundException('Invalid province code');
    const ward = await this.locations.findWard(wardCode);
    if (!ward || ward.provinceCode !== provinceCode) {
      throw new NotFoundException('Invalid ward code for the province');
    }
    return { province, ward };
  }

  /**
   * Import the latest administrative data from provinces.open-api.vn (v2) into
   * our own DB, so address lookups are served locally (no runtime dependency on
   * the public API). Idempotent — safe to re-run when the dataset changes.
   */
  async syncFromOpenApi(): Promise<{ provinces: number; wards: number }> {
    let data: ApiProvince[];
    try {
      const res = await fetch(OPEN_API_TREE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = (await res.json()) as ApiProvince[];
    } catch (err) {
      this.logger.error('Failed to fetch administrative data', err as Error);
      throw new ServiceUnavailableException('Address API is unreachable');
    }

    const provinces: Partial<Province>[] = data.map((p) => ({
      code: p.code,
      name: p.name,
      divisionType: p.division_type,
      codename: p.codename,
      phoneCode: p.phone_code,
    }));
    const wards: Partial<Ward>[] = data.flatMap((p) =>
      (p.wards ?? []).map((w) => ({
        code: w.code,
        name: w.name,
        divisionType: w.division_type,
        codename: w.codename,
        provinceCode: p.code,
      })),
    );

    await this.locations.upsertProvinces(provinces);
    await this.locations.upsertWards(wards);
    this.logger.log(
      `Synced ${provinces.length} provinces, ${wards.length} wards`,
    );
    return { provinces: provinces.length, wards: wards.length };
  }

  countProvinces(): Promise<number> {
    return this.locations.countProvinces();
  }
}
