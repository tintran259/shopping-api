import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesController } from './controllers/branches.controller';
import { Branch } from './entities/branch.entity';
import { Inventory } from './entities/inventory.entity';
import { BranchesRepository } from './repositories/branches.repository';
import { InventoryRepository } from './repositories/inventory.repository';
import { BranchesService } from './services/branches.service';
import { InventoryService } from './services/inventory.service';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Inventory])],
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
