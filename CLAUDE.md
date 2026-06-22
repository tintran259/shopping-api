# Shopping API Rules

## Tech Stack

* NestJS
* TypeScript (strict mode)
* TypeORM
* PostgreSQL 16
* JWT Authentication
* Docker
* Swagger

---

## Architecture

All modules MUST follow:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Entity
    ↓
Database
```

### Required Structure

```text
src/modules/<module>/

├── controllers/
├── services/
├── repositories/
├── entities/
├── dto/
└── <module>.module.ts
```

---

## Controller Rules

Controllers MUST:

* Handle HTTP requests only
* Validate DTOs
* Call Services

Controllers MUST NOT:

* Contain business logic
* Access Repository directly
* Use TypeORM Repository

---

## Service Rules

Services MUST:

* Contain all business logic
* Coordinate repositories/modules
* Handle transactions

Services MUST NOT:

* Inject TypeORM Repository
* Use QueryBuilder directly

✅ Good

```ts
constructor(
  private readonly productsRepository: ProductsRepository,
) {}
```

❌ Bad

```ts
constructor(
  @InjectRepository(Product)
  private readonly repository: Repository<Product>,
) {}
```

---

## Repository Rules

Repositories MUST:

* Own all database access
* Inject TypeORM Repository
* Contain QueryBuilder logic
* Handle filtering, joins, pagination

Repositories MUST NOT:

* Contain business logic
* Call Services

---

## Entity Rules

Entities represent database schema only.

Entities MUST NOT contain:

* Business logic
* Service calls
* Query logic

---

## DTO Rules

Every request MUST use DTOs with:

```ts
class-validator
class-transformer
```

Never use:

```ts
@Body() body: any
```

---

## Database Rules

Database:

```text
snake_case
```

TypeScript:

```text
camelCase
```

Example:

```ts
@Column({ name: 'product_name' })
productName: string;
```

---

## Money Rules

Always use:

```sql
numeric(12,2)
```

Entity:

```ts
@Column({
  type: 'numeric',
  precision: 12,
  scale: 2,
})
price: string;
```

Never store money as float/double.

---

## Authentication Rules

* JWT is global
* Public routes use `@Public()`
* Admin routes use `@Roles()` + `RolesGuard`
* Current user via `@CurrentUser()`

Never decode JWT manually.

---

## Transaction Rules

Use transactions for:

* Checkout
* Payments
* Stock updates
* Coupon usage

```ts
await this.dataSource.transaction(...)
```

---

## Error Handling

Use NestJS Exceptions:

```ts
BadRequestException
UnauthorizedException
ForbiddenException
NotFoundException
ConflictException
```

Never return custom error objects from services.

---

## Pagination

All list APIs should support:

```text
page
limit
sortBy
sortOrder
```

Defaults:

```text
page = 1
limit = 20
max limit = 100
```

---

## Dependency Rules

✅ Allowed

```text
Controller → Service
Service → Repository
Repository → TypeORM
```

❌ Forbidden

```text
Controller → Repository
Controller → TypeORM
Service → TypeORM
Repository → Service
```

---

## Coding Rules

* Use strict TypeScript
* Avoid `any`
* Use enums instead of magic strings
* Use constants for shared values
* Use readonly where possible
* File names must be kebab-case

Example:

```text
product.service.ts
product.repository.ts
create-product.dto.ts
```

---

## Claude Code Requirements

When generating code:

1. Always create Controller + Service + Repository.
2. Never inject TypeORM Repository into Service.
3. Keep business logic inside Service.
4. Keep database logic inside Repository.
5. Always create DTOs.
6. Always use validation decorators.
7. Use transactions for critical operations.
8. Generate production-ready NestJS code only.
