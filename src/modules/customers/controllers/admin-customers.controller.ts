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
import { AdminCustomerQueryDto } from '../dto/admin-customer-query.dto';
import { CreateB2bCustomerDto } from '../dto/create-b2b-customer.dto';
import { UpdateCustomerStatusDto } from '../dto/update-customer-status.dto';
import { CustomersService } from '../services/customers.service';

/** Back-office customer management (B2C/B2B) — every route requires an admin
 *  (guarded at the class level). Staff/admin accounts never appear in this
 *  list (see `CustomersRepository.searchAdmin`). */
@ApiTags('admin/customers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(CustomerRole.ADMIN)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers — filter by type/status, search (q), sort' })
  findAll(@Query() query: AdminCustomerQueryDto) {
    return this.customers.findAllAdmin(query);
  }

  @Post('b2b')
  @ApiOperation({
    summary: 'Create a B2B account + company profile (staff-entered, e.g. a sales deal closed offline)',
  })
  createB2b(@Body() dto: CreateB2bCustomerDto) {
    return this.customers.createB2b(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by id (incl. B2B profile + addresses)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findByIdAdmin(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Suspend or reactivate a customer account' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    return this.customers.updateStatus(id, dto.status);
  }
}
