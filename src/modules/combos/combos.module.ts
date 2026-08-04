import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesModule } from '../branches/branches.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminCombosController } from './controllers/admin-combos.controller';
import { CombosController } from './controllers/combos.controller';
import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { CombosRepository } from './repositories/combos.repository';
import { CombosService } from './services/combos.service';

/**
 * Combo sản phẩm. Dùng `ProductsService` (CatalogModule) để validate/định giá
 * biến thể và `InventoryService` (BranchesModule) để tính tồn khả dụng. Export
 * `CombosService` cho tích hợp đặt đơn (Phase A2).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Combo, ComboItem]),
    CatalogModule,
    BranchesModule,
  ],
  controllers: [AdminCombosController, CombosController],
  providers: [CombosService, CombosRepository],
  exports: [CombosService],
})
export class CombosModule {}
