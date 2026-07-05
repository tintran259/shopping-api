import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from '../catalog/entities/product-variant.entity';
import { BranchesController } from './controllers/branches.controller';
import { Branch } from './entities/branch.entity';
import { Inventory } from './entities/inventory.entity';
import { BranchesRepository } from './repositories/branches.repository';
import { InventoryRepository } from './repositories/inventory.repository';
import { BranchesService } from './services/branches.service';
import { InventoryService } from './services/inventory.service';

@Module({
  // ProductVariant is registered here (not via CatalogModule) purely so
  // InventoryService can read a variant's parent product status — importing
  // CatalogModule itself would be circular, since it already imports
  // BranchesModule.
  imports: [TypeOrmModule.forFeature([Branch, Inventory, ProductVariant])],
  controllers: [BranchesController],
  providers: [
    BranchesService,
    InventoryService,
    BranchesRepository,
    InventoryRepository,
  ],
  exports: [BranchesService, InventoryService],
})
export class BranchesModule {}
