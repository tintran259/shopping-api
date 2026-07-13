import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreateGhnShipmentDto } from '../dto/create-ghn-shipment.dto';
import { CreateGhtkShipmentDto } from '../dto/create-ghtk-shipment.dto';
import { MockWebhookDto } from '../dto/mock-webhook.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { UpsertShipmentDto } from '../dto/upsert-shipment.dto';
import { GhnService } from '../services/ghn.service';
import { GhtkService } from '../services/ghtk.service';
import { OrdersService } from '../services/orders.service';
import { ShipmentsService } from '../services/shipments.service';

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
  constructor(
    private readonly orders: OrdersService,
    private readonly shipments: ShipmentsService,
    private readonly ghn: GhnService,
    private readonly ghtk: GhtkService,
  ) {}

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

  @Get(':id/shipment')
  @ApiOperation({
    summary:
      'Get the order’s shipment tracking info (carrier/tracking no/fee/status) — ' +
      'independent of the order’s own fulfilment status. Null if never filled in.',
  })
  getShipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipments.findByOrder(id);
  }

  @Put(':id/shipment')
  @ApiOperation({
    summary: 'Create or update the order’s shipment tracking info',
  })
  upsertShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertShipmentDto,
  ) {
    return this.shipments.upsert(id, dto);
  }

  @Post(':id/shipment/ghn')
  @ApiOperation({
    summary:
      'Explicitly create a real GHN shipping order for this order (admin picks GHN, clicks create) — address/weight/etc. are derived server-side, only an optional shipper note can be added.',
  })
  createGhnShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGhnShipmentDto,
  ) {
    return this.ghn.createShippingOrder(id, dto);
  }

  @Get(':id/shipment/label')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary:
      'Return printable GHTK label HTML for this order. Mock mode (no GHTK_TOKEN): generates a label from order data so the print flow can be tested locally.',
  })
  getShipmentLabel(@Param('id', ParseUUIDPipe) id: string): Promise<string> {
    return this.ghtk.getLabelHtml(id);
  }

  @Post(':id/shipment/ghtk')
  @ApiOperation({
    summary:
      'Explicitly create a real GHTK shipping order for this order (admin picks GHTK, fills the delivery district, clicks create).',
  })
  createGhtkShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGhtkShipmentDto,
  ) {
    return this.ghtk.createShippingOrder(id, dto);
  }

  @Post(':id/shipment/reset')
  @ApiOperation({
    summary:
      'Reset a failed shipment (returned/problem/pickup-failed) so the admin can pick a carrier and create a fresh shipment from scratch.',
  })
  resetShipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipments.resetForRedeliver(id);
  }

  @Post(':id/shipment/mock-webhook')
  @ApiOperation({
    summary:
      'Testing helper — simulates the carrier webhook (GHN/GHTK can’t reach localhost) so the status-sync flow can be exercised without a real account.',
  })
  simulateCarrierWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MockWebhookDto,
  ) {
    return this.shipments.simulateCarrierWebhook(id, dto.carrierStatus);
  }
}
