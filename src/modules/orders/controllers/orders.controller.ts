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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CheckoutDto, GuestCheckoutDto } from '../dto/checkout.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrdersService } from '../services/orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place an order from my active cart' })
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @Public()
  @Post('guest-checkout')
  @ApiOperation({ summary: 'Place an order as a guest (items in body)' })
  guestCheckout(@Body() dto: GuestCheckoutDto) {
    return this.orders.guestCheckout(dto);
  }

  @Public()
  @Get('track')
  @ApiOperation({ summary: 'Track an order by code + phone (guest)' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'phone', required: true })
  track(@Query('code') code: string, @Query('phone') phone: string) {
    return this.orders.track(code, phone);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.orders.findMine(user.id, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one of my orders' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.findOneForUser(user.id, id);
  }

  // ── Admin ──────────────────────────────────────────────────────────
  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] List all orders' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.orders.findAll(query);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Update order fulfilment status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Post(':id/confirm-payment')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({
    summary: '[admin] Confirm payment (gateway webhook stand-in)',
  })
  confirmPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirmPayment(id);
  }
}
