import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { SubmitOrderReviewDto } from '../../reviews/dto/review.dto';
import { CheckoutDto, GuestCheckoutDto } from '../dto/checkout.dto';
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

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel one of my orders (if not yet shipped)' })
  cancelMine(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.cancelForUser(user.id, id);
  }

  @Post(':code/reviews')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Review a delivered order (creates one review per product)',
  })
  submitReview(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body() dto: SubmitOrderReviewDto,
  ) {
    return this.orders.createOrderReviews(user.id, code, dto);
  }
}
