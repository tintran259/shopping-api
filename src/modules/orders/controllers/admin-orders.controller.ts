import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminOrderQueryDto } from '../dto/admin-order-query.dto';
import { AdminOrderSummaryQueryDto } from '../dto/admin-order-summary-query.dto';
import { AdminCreateOrderDto } from '../dto/checkout.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrdersService } from '../services/orders.service';

/**
 * Back-office order management. Every route requires an admin (guarded at the
 * class level), and — unlike the customer-facing `/orders` controller — none of
 * these methods enforce order ownership.
 */
@ApiTags('admin/orders')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(CustomerRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create an order on behalf of a customer/walk-in (staff-entered — phone order, ' +
      'in-branch pickup sale, B2B deal closed offline). Items are resolved and priced ' +
      'server-side, same as the storefront, but this is a distinct admin-only path.',
  })
  create(@Body() dto: AdminCreateOrderDto) {
    return this.orders.adminCreate(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders — filter by branch/status/payment, search (q), sort',
  })
  findAll(@Query() query: AdminOrderQueryDto) {
    return this.orders.findAll(query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Dashboard aggregate — branch/date-range scoped order count, PAID revenue, ' +
      'per-status breakdown and a daily revenue series (SQL COUNT/SUM, not paginated)',
  })
  summary(@Query() query: AdminOrderSummaryQueryDto) {
    return this.orders.summary(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any order by id (no ownership check)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order fulfilment status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Post(':id/confirm-payment')
  @ApiOperation({ summary: 'Confirm payment (gateway webhook stand-in)' })
  confirmPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirmPayment(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel any order (BE enforces the not-shipped rule)',
  })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(id);
  }
}
