import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './controllers/locations.controller';
import { Province } from './entities/province.entity';
import { Ward } from './entities/ward.entity';
import { LocationsRepository } from './repositories/locations.repository';
import { LocationsService } from './services/locations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Province, Ward])],
  controllers: [LocationsController],
  providers: [LocationsService, LocationsRepository],
  exports: [LocationsService],
})
export class LocationsModule {}
