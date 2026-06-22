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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { AddressesService } from '../services/addresses.service';
import { CustomersService } from '../services/customers.service';
import { CreateAddressDto, UpdateAddressDto } from '../dto/address.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('me')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly addresses: AddressesService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get my profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.customers.findById(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.customers.updateProfile(user.id, dto);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List my addresses' })
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.addresses.findAll(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add an address' })
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update an address' })
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an address' })
  removeAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addresses.remove(user.id, id);
  }
}
