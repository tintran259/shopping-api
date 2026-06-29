import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { WishlistController } from './controllers/wishlist.controller';
import { WishlistItem } from './entities/wishlist-item.entity';
import { Wishlist } from './entities/wishlist.entity';
import { WishlistRepository } from './repositories/wishlist.repository';
import { WishlistService } from './services/wishlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wishlist, WishlistItem]), CatalogModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistRepository],
})
export class WishlistModule {}
