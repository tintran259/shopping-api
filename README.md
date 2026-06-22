# shopping-api

E-commerce **commerce backend** for the shopping platform — built with **NestJS + TypeORM + PostgreSQL**.
It complements [`shopping-cms`](../shopping-cms) (Strapi), which owns the presentation/CMS layer (banners,
menus, themes, landing pages, payment-method *config*). This API owns the transactional commerce domain:

| Domain | Endpoints |
| --- | --- |
| **Auth & Customers** | register / login (JWT), profile, address book |
| **Catalog** | categories, products, variants (public read, admin write) |
| **Cart** | per-user cart with stock-aware add/update/remove |
| **Orders** | checkout (cart → order, atomic stock reservation), order history, admin status |
| **Payments** | payment records per order, confirm/webhook stand-in |
| **Coupons** | percentage/fixed coupons, public `validate`, admin CRUD |

Payment method codes (`bank_transfer`, `momo`, `atm_card`, `cod`) mirror the `payment-method` content type
in `shopping-cms`.

## Quick start

```bash
cp .env.example .env          # adjust if needed (DB on host port 5433 to avoid clashing with the CMS DB)
docker compose up -d          # start PostgreSQL 16
npm install
npm run start:dev             # boots on http://localhost:3000/api  (Swagger: /api/docs)
npm run seed                  # optional: admin user + sample product + coupon
```

> `DB_SYNCHRONIZE=true` (dev default) auto-creates tables from the entities, so the API is runnable
> immediately. For production set it to `false` and use migrations.

## Migrations (production)

```bash
npm run migration:generate -- src/database/migrations/Init   # diff entities → migration
npm run migration:run
npm run migration:revert
```

## Auth model

A global `JwtAuthGuard` protects every route; mark public routes with `@Public()`. Admin-only routes add
`@UseGuards(RolesGuard)` + `@Roles(UserRole.ADMIN)`. Send `Authorization: Bearer <accessToken>` from
`POST /api/auth/login`.

## Layout

```
src/
├── common/        # base entity, enums, DTOs, guards-adjacent decorators, exception filter
├── config/        # typed env configuration
├── database/      # data-source (CLI), migrations, seeds
└── modules/
    ├── auth/      # JWT strategy, guards, login/register
    ├── customers/ # users + addresses
    ├── catalog/   # categories, products, variants
    ├── cart/      # cart + cart items
    ├── orders/    # orders + order items (checkout)
    ├── payments/  # payment records
    └── coupons/   # discount coupons
```
