import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { VoucherCustomerScope } from '../../../common/enums';
import { AdminVoucherQueryDto } from '../dto/admin-voucher-query.dto';
import {
  CheckVoucherDto,
  CreateVoucherDto,
  UpdateVoucherDto,
} from '../dto/voucher.dto';
import { Voucher } from '../entities/voucher.entity';
import { VouchersService } from '../services/vouchers.service';

/** Needs a logged-in session: `users` (any account) or `specific` with a non-empty list. */
function requiresCustomer(v: Voucher): boolean {
  if (v.customerScope === VoucherCustomerScope.USERS) return true;
  if (v.customerScope === VoucherCustomerScope.SPECIFIC)
    return (v.customers?.length ?? 0) > 0;
  return false;
}

/** Only for guests — a logged-in user must not apply this voucher. */
function guestsOnly(v: Voucher): boolean {
  return v.customerScope === VoucherCustomerScope.GUESTS;
}

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Public()
  @Get('available')
  @ApiOperation({
    summary:
      'List active vouchers for the storefront picker. Pass customerId to include vouchers assigned to that customer.',
  })
  @ApiQuery({ name: 'customerId', required: false })
  async listAvailable(@Query('customerId') customerId?: string) {
    const vouchers = await this.vouchers.listAvailable(customerId);
    return vouchers.map((v) => ({
      code: v.code,
      type: v.type,
      value: Number(v.value),
      minSubtotal: Number(v.minSubtotal),
      maxDiscount: v.maxDiscount != null ? Number(v.maxDiscount) : undefined,
      endsAt: v.endsAt?.toISOString(),
      applicableProducts: v.products?.length
        ? v.products.map((p) => ({ id: p.id, slug: p.slug, name: p.name }))
        : undefined,
      applicableBranches: v.branches?.length
        ? v.branches.map((b) => ({ id: b.id, name: b.name }))
        : undefined,
      requiresCustomer: requiresCustomer(v),
      guestsOnly: guestsOnly(v),
    }));
  }

  @Public()
  @Get('validate')
  @ApiOperation({
    summary:
      'Validate a voucher against a subtotal + cart/branch/customer scoping',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'subtotal', required: true, type: Number })
  @ApiQuery({ name: 'shippingFee', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({
    name: 'productIds',
    required: false,
    description: 'Comma-separated product ids in the cart',
  })
  async validate(
    @Query('code') code: string,
    @Query('subtotal') subtotal: string,
    @Query('shippingFee') shippingFee?: string,
    @Query('branchId') branchId?: string,
    @Query('customerId') customerId?: string,
    @Query('productIds') productIds?: string,
    @Query('shippingMethod') shippingMethod?: string,
  ) {
    const { voucher, discount } = await this.vouchers.evaluate(
      code,
      Number(subtotal),
      Number(shippingFee ?? 0),
      {
        branchId,
        customerId,
        productSlugs: productIds?.split(',').filter(Boolean),
        shippingMethod,
      },
    );
    return {
      valid: true,
      code: voucher.code,
      type: voucher.type,
      value: Number(voucher.value),
      minSubtotal: Number(voucher.minSubtotal),
      maxDiscount:
        voucher.maxDiscount != null ? Number(voucher.maxDiscount) : undefined,
      endsAt: voucher.endsAt?.toISOString(),
      applicableProducts: voucher.products?.length
        ? voucher.products.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
          }))
        : undefined,
      applicableBranches: voucher.branches?.length
        ? voucher.branches.map((b) => ({ id: b.id, name: b.name }))
        : undefined,
      applicableShippingMethods: voucher.shippingMethods?.length
        ? voucher.shippingMethods
        : undefined,
      requiresCustomer: requiresCustomer(voucher),
      guestsOnly: guestsOnly(voucher),
      discount,
    };
  }

  @Public()
  @Post('check')
  @ApiOperation({
    summary:
      'Check voucher validity + compute discount via POST body (verifies usage limits)',
  })
  async check(@Body() dto: CheckVoucherDto) {
    const { voucher, discount } = await this.vouchers.evaluate(
      dto.code,
      dto.subtotal,
      dto.shippingFee ?? 0,
      {
        branchId: dto.branchId,
        customerId: dto.customerId,
        productSlugs: dto.productSlugs,
        shippingMethod: dto.shippingMethod,
      },
    );
    return {
      valid: true,
      code: voucher.code,
      type: voucher.type,
      value: Number(voucher.value),
      minSubtotal: Number(voucher.minSubtotal),
      maxDiscount:
        voucher.maxDiscount != null ? Number(voucher.maxDiscount) : undefined,
      endsAt: voucher.endsAt?.toISOString(),
      applicableProducts: voucher.products?.length
        ? voucher.products.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
          }))
        : undefined,
      applicableBranches: voucher.branches?.length
        ? voucher.branches.map((b) => ({ id: b.id, name: b.name }))
        : undefined,
      applicableShippingMethods: voucher.shippingMethods?.length
        ? voucher.shippingMethods
        : undefined,
      requiresCustomer: requiresCustomer(voucher),
      guestsOnly: guestsOnly(voucher),
      discount,
    };
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermission('vouchers.view')
  @ApiOperation({
    summary: '[admin] List vouchers — paginated, filterable by q/state',
  })
  findAll(@Query() query: AdminVoucherQueryDto) {
    return this.vouchers.findAllPaginated(query);
  }

  @Get('stats')
  @ApiBearerAuth()
  @RequirePermission('vouchers.view')
  @ApiOperation({
    summary: '[admin] Voucher counts by state, for the list page stat cards',
  })
  stats() {
    return this.vouchers.stateCounts();
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermission('vouchers.view')
  @ApiOperation({
    summary: '[admin] Get a voucher by id (incl. scoping relations)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchers.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('vouchers.create')
  @ApiOperation({ summary: '[admin] Create a voucher' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermission('vouchers.update')
  @ApiOperation({ summary: '[admin] Update a voucher' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermission('vouchers.delete')
  @ApiOperation({ summary: '[admin] Delete a voucher' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchers.remove(id);
  }
}
