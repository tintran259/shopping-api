import { Province } from '../../modules/locations/entities/province.entity';
import { Ward } from '../../modules/locations/entities/ward.entity';
import { AppDataSource } from '../data-source';

/**
 * Import VN administrative units (2025 2-tier model) from
 * provinces.open-api.vn v2 into our own DB. Idempotent (upsert by code).
 * Run with: npm run sync:locations
 */
const OPEN_API_TREE = 'https://provinces.open-api.vn/api/v2/?depth=2';

async function sync() {
  const ds = await AppDataSource.initialize();
  console.log('🌍 Syncing provinces/wards from', OPEN_API_TREE);

  const res = await fetch(OPEN_API_TREE);
  if (!res.ok) throw new Error(`Address API HTTP ${res.status}`);
  const data = (await res.json()) as any[];

  const provinces = data.map((p) => ({
    code: p.code,
    name: p.name,
    divisionType: p.division_type,
    codename: p.codename,
    phoneCode: p.phone_code,
  }));
  const wards = data.flatMap((p) =>
    (p.wards ?? []).map((w: any) => ({
      code: w.code,
      name: w.name,
      divisionType: w.division_type,
      codename: w.codename,
      provinceCode: p.code,
    })),
  );

  await ds.getRepository(Province).upsert(provinces, ['code']);
  for (let i = 0; i < wards.length; i += 500) {
    await ds.getRepository(Ward).upsert(wards.slice(i, i + 500), ['code']);
  }

  console.log(`✅ Synced ${provinces.length} provinces, ${wards.length} wards`);
  await ds.destroy();
}

sync().catch((err) => {
  console.error('Location sync failed:', err);
  process.exit(1);
});
