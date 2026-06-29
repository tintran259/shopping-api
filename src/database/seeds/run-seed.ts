import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import {
  CustomerRole,
  InventoryStatus,
  OptionDisplayType,
  ProductStatus,
  VoucherType,
} from '../../common/enums';
import { Branch } from '../../modules/branches/entities/branch.entity';
import { Inventory } from '../../modules/branches/entities/inventory.entity';
import { Brand } from '../../modules/catalog/entities/brand.entity';
import { Category } from '../../modules/catalog/entities/category.entity';
import { ProductVariant } from '../../modules/catalog/entities/product-variant.entity';
import { Product } from '../../modules/catalog/entities/product.entity';
import { Customer } from '../../modules/customers/entities/customer.entity';
import { Province } from '../../modules/locations/entities/province.entity';
import { Ward } from '../../modules/locations/entities/ward.entity';
import { Voucher } from '../../modules/vouchers/entities/voucher.entity';
import { AppDataSource } from '../data-source';

/**
 * Dev seed mirroring the storefront mock data (repo `shopping/`):
 *   - branches  → src/services/branch.service.ts (MOCK_BRANCHES)
 *   - catalog   → src/services/product.service.ts (CATEGORIES, BRANDS, DALAT_SPECIALTIES)
 *   - vouchers  → src/services/voucher.service.ts (VOUCHERS)
 * Idempotent: keyed by slug/code/name, safe to re-run.
 */

const round1k = (n: number) => Math.round(n / 1000) * 1000;

// ── FE: MOCK_BRANCHES ────────────────────────────────────────────────
const BRANCHES = [
  {
    name: 'Chi nhánh Quận 1',
    address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
    city: 'TP. Hồ Chí Minh',
    provinceCode: '79',
    phone: '1900 1234',
    isDefault: true,
  },
  {
    name: 'Chi nhánh Quận 7',
    address: '456 Nguyễn Thị Thập, Phường Tân Phú, Quận 7',
    city: 'TP. Hồ Chí Minh',
    provinceCode: '79',
    phone: '1900 1235',
    isDefault: false,
  },
  {
    name: 'Chi nhánh Hoàn Kiếm',
    address: '78 Hàng Bài, Phường Tràng Tiền, Quận Hoàn Kiếm',
    city: 'Hà Nội',
    provinceCode: '1',
    phone: '1900 1236',
    isDefault: false,
  },
  {
    name: 'Chi nhánh Hải Châu',
    address: '12 Trần Phú, Phường Hải Châu 1, Quận Hải Châu',
    city: 'Đà Nẵng',
    provinceCode: '48',
    phone: '1900 1237',
    isDefault: false,
  },
];

// ── FE: CATEGORIES ───────────────────────────────────────────────────
const CATEGORIES = [
  { slug: 'ao-thun', name: 'Áo thun', sortOrder: 1 },
  { slug: 'giay', name: 'Giày', sortOrder: 2 },
  { slug: 'qua-luu-niem', name: 'Quà lưu niệm', sortOrder: 3 },
  { slug: 'dac-san', name: 'Đặc sản', sortOrder: 4 },
];

// ── FE: BRANDS ───────────────────────────────────────────────────────
const BRANDS = [
  { slug: 'aurora', name: 'Aurora' },
  { slug: 'lumen', name: 'Lumen' },
  { slug: 'northpeak', name: 'NorthPeak' },
  { slug: 'nha-go', name: 'Nhà Gỗ' },
  { slug: 'gom-bat-trang', name: 'Gốm Bát Tràng' },
  { slug: 'may-tre-viet', name: 'Mây Tre Việt' },
  { slug: 'latas-dalat', name: "LATA'S Đà Lạt" },
  { slug: 'htx-cau-dat', name: 'HTX Cầu Đất' },
  { slug: 'vuon-dau-da-lat', name: 'Vườn Dâu Đà Lạt' },
];
const SPECIALTY_BRANDS = ['latas-dalat', 'htx-cau-dat', 'vuon-dau-da-lat'];

// ── FE: Đà Lạt specialty images (Shopee CDN) ─────────────────────────
const SU = 'https://down-vn.img.susercontent.com/file/';
const IMG = {
  khoai: SU + 'vn-11134207-81ztc-mn8d3mybh5ag17',
  mutDau: SU + 'vn-11134207-81ztc-mn2nlhcrpcso28',
  hong: SU + 'vn-11134207-81ztc-mn6zrd0zzpqe34',
  dauTay: SU + 'vn-11134207-81ztc-mn13pkt3l4as2c',
  macca: SU + 'vn-11134207-81ztc-mn6of31w7hfo84',
  caphe: SU + 'vn-11134207-81ztc-mn2p5ygzvev4d7',
};

// ── FE: DALAT_SPECIALTIES ────────────────────────────────────────────
const DALAT = [
  {
    slug: 'khoai-lang-say-deo',
    name: 'Khoai lang sấy dẻo',
    img: IMG.khoai,
    region: 'Đà Lạt',
    cert: 'OCOP 3★',
    flavor: 'Ngọt',
    weights: ['250g', '500g', '1kg'],
    base: 65_000,
  },
  {
    slug: 'mut-dau-tay-deo',
    name: 'Mứt dâu tây dẻo',
    img: IMG.mutDau,
    region: 'Đà Lạt',
    cert: 'OCOP 3★',
    flavor: 'Chua ngọt',
    weights: ['250g', '500g', 'Hộp quà'],
    base: 85_000,
  },
  {
    slug: 'hong-treo-gio',
    name: 'Hồng treo gió',
    img: IMG.hong,
    region: 'Đà Lạt',
    cert: 'OCOP 4★',
    flavor: 'Ngọt',
    weights: ['500g', '1kg'],
    base: 220_000,
  },
  {
    slug: 'dau-tay-say-deo',
    name: 'Dâu tây sấy dẻo',
    img: IMG.dauTay,
    region: 'Đà Lạt',
    cert: 'VietGAP',
    flavor: 'Chua ngọt',
    weights: ['100g', '250g', '500g'],
    base: 75_000,
  },
  {
    slug: 'hat-mac-ca',
    name: 'Hạt mắc ca',
    img: IMG.macca,
    region: 'Lâm Đồng',
    cert: 'VietGAP',
    flavor: 'Bùi',
    weights: ['250g', '500g', '1kg'],
    base: 120_000,
  },
  {
    slug: 'ca-phe-cau-dat',
    name: 'Cà phê Cầu Đất (Arabica)',
    img: IMG.caphe,
    region: 'Cầu Đất',
    cert: 'OCOP 4★',
    flavor: 'Đắng',
    weights: ['250g', '500g', '1kg'],
    base: 110_000,
  },
  {
    slug: 'tra-atiso-tui-loc',
    name: 'Trà atiso túi lọc',
    img: IMG.khoai,
    region: 'Đà Lạt',
    cert: 'OCOP 3★',
    flavor: 'Thanh mát',
    weights: ['Hộp 20 túi', 'Hộp 50 túi'],
    base: 55_000,
  },
  {
    slug: 'cao-atiso',
    name: 'Cao atiso nguyên chất',
    img: IMG.mutDau,
    region: 'Đà Lạt',
    cert: 'OCOP 4★',
    flavor: 'Thanh mát',
    weights: ['200g', '500g'],
    base: 140_000,
  },
  {
    slug: 'mut-hong-deo',
    name: 'Mứt hồng dẻo',
    img: IMG.hong,
    region: 'Đà Lạt',
    cert: 'OCOP 3★',
    flavor: 'Ngọt',
    weights: ['250g', '500g'],
    base: 115_000,
  },
  {
    slug: 'tra-oolong-cau-dat',
    name: 'Trà oolong Cầu Đất',
    img: IMG.caphe,
    region: 'Cầu Đất',
    cert: 'OCOP 4★',
    flavor: 'Thanh mát',
    weights: ['100g', '250g'],
    base: 130_000,
  },
  {
    slug: 'ruou-vang-da-lat',
    name: 'Rượu vang Đà Lạt',
    img: IMG.dauTay,
    region: 'Đà Lạt',
    cert: undefined,
    flavor: 'Chát nhẹ',
    weights: ['Chai 750ml'],
    base: 180_000,
  },
];

// ── FE: VOUCHERS ─────────────────────────────────────────────────────
const VOUCHERS = [
  {
    code: 'DACSAN10',
    type: VoucherType.PERCENT,
    value: '10',
    minSubtotal: '200000',
    maxDiscount: '30000',
  },
  {
    code: 'WELCOME15',
    type: VoucherType.PERCENT,
    value: '15',
    minSubtotal: '100000',
    maxDiscount: '50000',
  },
  {
    code: 'GIAM50K',
    type: VoucherType.FIXED,
    value: '50000',
    minSubtotal: '300000',
  },
  {
    code: 'FREESHIP',
    type: VoucherType.SHIPPING,
    value: '30000',
    minSubtotal: '150000',
  },
];

interface SeedVariant {
  sku: string;
  price: string;
  compareAt?: string;
  optionValues?: Record<string, string>;
}
interface SeedProduct {
  slug: string;
  name: string;
  brandSlug: string;
  categorySlug: string;
  status: ProductStatus;
  basePrice: string;
  shortDescription?: string;
  image: string;
  attributes?: { key: string; label: string; value: string }[];
  options?: {
    name: string;
    displayType: OptionDisplayType;
    values: string[];
  }[];
  variants: SeedVariant[];
}

async function seedProduct(
  ds: DataSource,
  p: SeedProduct,
  brandId: Record<string, string>,
  categoryId: Record<string, string>,
) {
  const products = ds.getRepository(Product);
  if (await products.findOne({ where: { slug: p.slug } })) return;

  const category = { id: categoryId[p.categorySlug] } as Category;
  const product = await products.save(
    products.create({
      slug: p.slug,
      name: p.name,
      brandId: brandId[p.brandSlug],
      status: p.status,
      basePrice: p.basePrice,
      shortDescription: p.shortDescription,
      categories: [category],
      images: [
        { url: p.image, alt: p.name, isPrimary: true, sortOrder: 0 },
      ] as any,
      attributes: (p.attributes ?? []) as any,
      options: (p.options ?? []).map((o, i) => ({
        name: o.name,
        displayType: o.displayType,
        sortOrder: i,
        values: o.values.map((v, j) => ({ value: v, sortOrder: j })),
      })) as any,
    }),
  );

  // Re-read option values to link variants.
  const full = await products.findOne({
    where: { id: product.id },
    relations: { options: { values: true } },
  });
  const lookup = new Map<string, ProductOptionValueRef>();
  for (const o of full!.options ?? []) {
    for (const v of o.values ?? [])
      lookup.set(`${o.name}::${v.value}`, { id: v.id });
  }

  const variantRepo = ds.getRepository(ProductVariant);
  await variantRepo.save(
    p.variants.map((v) =>
      variantRepo.create({
        productId: product.id,
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAt,
        imageUrl: p.image,
        optionValues: Object.entries(v.optionValues ?? {})
          .map(([n, val]) => lookup.get(`${n}::${val}`))
          .filter(Boolean) as ProductOptionValueRef[],
      }),
    ),
  );
}

/**
 * Per-branch inventory — each branch carries a DIFFERENT subset of products
 * (different counts → different listings/images per branch). Re-runnable: rebuilds
 * the whole inventory table so the distribution always reflects this code.
 */
async function seedInventory(
  ds: DataSource,
  branches: Branch[],
): Promise<number> {
  const inventoryRepo = ds.getRepository(Inventory);
  const variantRepo = ds.getRepository(ProductVariant);
  // Rebuild from scratch. `.delete({})` is blocked (empty-criteria guard), so
  // issue an explicit "DELETE FROM inventory" via the query builder.
  await inventoryRepo.createQueryBuilder().delete().execute();
  const variants = await variantRepo.find({ relations: { product: true } });

  const hash = (s: string): number => {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
    return Math.abs(h);
  };
  // Different subset per branch (different counts → different listings).
  const carries = (branchIndex: number, h: number): boolean => {
    switch (branchIndex) {
      case 0:
        return true; // flagship — carries everything
      case 1:
        return h % 4 !== 0; // ~75%
      case 2:
        return h % 2 === 0; // ~50%
      default:
        return h % 3 === 0; // ~33%
    }
  };

  const rows: Inventory[] = [];
  for (const variant of variants) {
    const h = hash(variant.product?.slug ?? variant.id);
    branches.forEach((b, i) => {
      if (!carries(i, h)) return;
      const oos = (h + i) % 9 === 0; // some carried-but-OOS for realism
      const quantity = oos ? 0 : 5 + ((h + i * 7) % 40);
      rows.push(
        inventoryRepo.create({
          branchId: b.id,
          variantId: variant.id,
          quantity,
          status:
            quantity > 0
              ? InventoryStatus.IN_STOCK
              : InventoryStatus.OUT_OF_STOCK,
        }),
      );
    });
  }
  await inventoryRepo.save(rows);
  return rows.length;
}
type ProductOptionValueRef = { id: string };

/** Build the curated specialty products from the FE DALAT presets. */
function buildSpecialtyProducts(): SeedProduct[] {
  return DALAT.map((d, idx) => {
    const onSale = idx % 2 === 0;
    const attributes = [
      { key: 'region', label: 'Vùng miền', value: d.region },
      ...(d.cert ? [{ key: 'cert', label: 'Chứng nhận', value: d.cert }] : []),
      ...(d.flavor
        ? [{ key: 'flavor', label: 'Hương vị', value: d.flavor }]
        : []),
    ];

    if (d.weights.length > 1) {
      const variants: SeedVariant[] = d.weights.map((w, vi) => {
        const price = round1k(d.base * (1 + vi * 0.7));
        return {
          sku: `${d.slug}-${w}`,
          price: price.toFixed(2),
          compareAt: onSale ? round1k(price * 1.25).toFixed(2) : undefined,
          optionValues: { 'Quy cách': w },
        };
      });
      return {
        slug: d.slug,
        name: d.name,
        brandSlug: SPECIALTY_BRANDS[idx % 3],
        categorySlug: 'dac-san',
        status: ProductStatus.ACTIVE,
        basePrice: round1k(d.base).toFixed(2),
        shortDescription: `${d.name} — đặc sản Đà Lạt, tự nhiên từ đất, ngọt lành từ tâm.`,
        image: d.img,
        attributes,
        options: [
          {
            name: 'Quy cách',
            displayType: OptionDisplayType.PILL,
            values: d.weights,
          },
        ],
        variants,
      };
    }
    // Simple product (single quy cách) → one default variant, no options.
    return {
      slug: d.slug,
      name: d.name,
      brandSlug: SPECIALTY_BRANDS[idx % 3],
      categorySlug: 'dac-san',
      status: ProductStatus.ACTIVE,
      basePrice: d.base.toFixed(2),
      shortDescription: `${d.name} — đặc sản Đà Lạt.`,
      image: d.img,
      attributes,
      variants: [{ sku: d.slug, price: d.base.toFixed(2), optionValues: {} }],
    };
  });
}

/** A couple of fashion/souvenir samples so every category is populated. */
const OTHER_PRODUCTS: SeedProduct[] = [
  {
    slug: 'ao-thun-aurora-basic',
    name: 'Áo thun Aurora Basic',
    brandSlug: 'aurora',
    categorySlug: 'ao-thun',
    status: ProductStatus.ACTIVE,
    basePrice: '180000.00',
    shortDescription: 'Áo thun cotton basic — chất lượng tuyển chọn.',
    image: 'https://picsum.photos/seed/ao-thun-aurora/600/750',
    attributes: [{ key: 'material', label: 'Chất liệu', value: 'Cotton' }],
    options: [
      {
        name: 'Màu sắc',
        displayType: OptionDisplayType.SWATCH,
        values: ['Đen', 'Trắng'],
      },
      {
        name: 'Kích thước',
        displayType: OptionDisplayType.PILL,
        values: ['M', 'L'],
      },
    ],
    variants: [
      {
        sku: 'ATA-DEN-M',
        price: '180000.00',
        optionValues: { 'Màu sắc': 'Đen', 'Kích thước': 'M' },
      },
      {
        sku: 'ATA-DEN-L',
        price: '180000.00',
        optionValues: { 'Màu sắc': 'Đen', 'Kích thước': 'L' },
      },
      {
        sku: 'ATA-TRG-M',
        price: '180000.00',
        optionValues: { 'Màu sắc': 'Trắng', 'Kích thước': 'M' },
      },
      {
        sku: 'ATA-TRG-L',
        price: '180000.00',
        optionValues: { 'Màu sắc': 'Trắng', 'Kích thước': 'L' },
      },
    ],
  },
  {
    slug: 'giay-northpeak-runner',
    name: 'Giày NorthPeak Runner',
    brandSlug: 'northpeak',
    categorySlug: 'giay',
    status: ProductStatus.ACTIVE,
    basePrice: '650000.00',
    shortDescription: 'Giày chạy bộ NorthPeak — chất lượng tuyển chọn.',
    image: 'https://picsum.photos/seed/giay-northpeak/600/750',
    options: [
      {
        name: 'Kích thước',
        displayType: OptionDisplayType.PILL,
        values: ['40', '41', '42'],
      },
    ],
    variants: [
      {
        sku: 'NPR-40',
        price: '650000.00',
        optionValues: { 'Kích thước': '40' },
      },
      {
        sku: 'NPR-41',
        price: '650000.00',
        optionValues: { 'Kích thước': '41' },
      },
      {
        sku: 'NPR-42',
        price: '650000.00',
        optionValues: { 'Kích thước': '42' },
      },
    ],
  },
  {
    slug: 'tuong-go-luu-niem',
    name: 'Tượng gỗ lưu niệm',
    brandSlug: 'nha-go',
    categorySlug: 'qua-luu-niem',
    status: ProductStatus.ACTIVE,
    basePrice: '150000.00',
    shortDescription: 'Tượng gỗ thủ công — quà lưu niệm.',
    image: 'https://picsum.photos/seed/tuong-go/600/750',
    attributes: [
      { key: 'material', label: 'Chất liệu', value: 'Gỗ' },
      { key: 'origin', label: 'Xuất xứ', value: 'Hội An' },
    ],
    variants: [{ sku: 'TGLN-01', price: '150000.00', optionValues: {} }],
  },
];

/** Import provinces/wards (2025 2-tier) from the latest open API into our DB. */
async function syncLocations(ds: DataSource) {
  const res = await fetch('https://provinces.open-api.vn/api/v2/?depth=2');
  if (!res.ok) {
    console.warn('  ! skipped locations sync (API HTTP ' + res.status + ')');
    return;
  }
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
  console.log(`  ✓ ${provinces.length} provinces, ${wards.length} wards`);
}

async function seed() {
  const ds = await AppDataSource.initialize();
  console.log('🌱 Seeding from FE mock data…');

  // Admin
  const customers = ds.getRepository(Customer);
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@shopping.local'
  ).toLowerCase();
  if (!(await customers.findOne({ where: { email: adminEmail } }))) {
    await customers.save(
      customers.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash(
          process.env.SEED_ADMIN_PASSWORD ?? 'admin12345',
          10,
        ),
        firstName: 'Admin',
        role: CustomerRole.ADMIN,
      }),
    );
    console.log(`  ✓ admin ${adminEmail}`);
  }

  // Administrative locations (provinces/wards) from the latest open API.
  await syncLocations(ds);

  // Branches
  const branchRepo = ds.getRepository(Branch);
  const branches: Branch[] = [];
  for (const b of BRANCHES) {
    let branch = await branchRepo.findOne({ where: { name: b.name } });
    if (!branch) branch = await branchRepo.save(branchRepo.create(b));
    branches.push(branch);
  }
  console.log(`  ✓ ${branches.length} branches`);

  // Categories
  const categoryRepo = ds.getRepository(Category);
  const categoryId: Record<string, string> = {};
  for (const c of CATEGORIES) {
    let cat = await categoryRepo.findOne({ where: { slug: c.slug } });
    if (!cat) cat = await categoryRepo.save(categoryRepo.create(c));
    categoryId[c.slug] = cat.id;
  }

  // Brands
  const brandRepo = ds.getRepository(Brand);
  const brandId: Record<string, string> = {};
  for (const b of BRANDS) {
    let brand = await brandRepo.findOne({ where: { slug: b.slug } });
    if (!brand) brand = await brandRepo.save(brandRepo.create(b));
    brandId[b.slug] = brand.id;
  }
  console.log(`  ✓ ${CATEGORIES.length} categories, ${BRANDS.length} brands`);

  // Products (specialties + samples)
  const all = [...buildSpecialtyProducts(), ...OTHER_PRODUCTS];
  for (const p of all) await seedProduct(ds, p, brandId, categoryId);
  console.log(`  ✓ ${all.length} products (+ variants)`);

  // Per-branch inventory (different subset per branch)
  const invCount = await seedInventory(ds, branches);
  console.log(`  ✓ ${invCount} inventory rows (per-branch distribution)`);

  // Vouchers
  const voucherRepo = ds.getRepository(Voucher);
  for (const v of VOUCHERS) {
    if (!(await voucherRepo.findOne({ where: { code: v.code } }))) {
      await voucherRepo.save(voucherRepo.create(v));
    }
  }
  console.log(`  ✓ ${VOUCHERS.length} vouchers`);

  await ds.destroy();
  console.log('✅ Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
