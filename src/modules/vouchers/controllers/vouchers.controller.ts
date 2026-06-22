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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateVoucherDto, UpdateVoucherDto } from '../dto/voucher.dto';
import { VouchersService } from '../services/vouchers.service';

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Public()
  @Get('validate')
  @ApiOperation({ summary: 'Validate a voucher against a subtotal' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'subtotal', required: true, type: Number })
  @ApiQuery({ name: 'shippingFee', required: false, type: Number })
  async validate(
    @Query('code') code: string,
    @Query('subtotal') subtotal: string,
    @Query('shippingFee') shippingFee?: string,
  ) {
    const { voucher, discount } = await this.vouchers.evaluate(
      code,
      Number(subtotal),
      Number(shippingFee ?? 0),
    );
    return { valid: true, code: voucher.code, type: voucher.type, discount };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] List vouchers' })
  findAll() {
    return this.vouchers.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Create a voucher' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Update a voucher' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Delete a voucher' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchers.remove(id);
  }
}
