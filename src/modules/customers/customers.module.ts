import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { CustomersController } from './controllers/customers.controller';
import { Address } from './entities/address.entity';
import { B2bProfile } from './entities/b2b-profile.entity';
import { Customer } from './entities/customer.entity';
import { AddressesRepository } from './repositories/addresses.repository';
import { CustomersRepository } from './repositories/customers.repository';
import { AddressesService } from './services/addresses.service';
import { CustomersService } from './services/customers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Address, B2bProfile]),
    LocationsModule,
  ],
  controllers: [CustomersController, AdminCustomersController],
  providers: [
    CustomersService,
    AddressesService,
    CustomersRepository,
    AddressesRepository,
  ],
  exports: [CustomersService, AddressesService],
})
export class CustomersModule {}
