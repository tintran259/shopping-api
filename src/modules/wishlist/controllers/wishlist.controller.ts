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
import {
  AddWishlistItemDto,
  CreateWishlistDto,
  UpdateWishlistDto,
} from '../dto/wishlist.dto';
import { WishlistService } from '../services/wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List my wishlists' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.wishlist.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a wishlist' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWishlistDto) {
    return this.wishlist.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a wishlist' })
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    return this.wishlist.rename(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a wishlist' })
  removeList(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wishlist.removeList(user.id, id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Save a product to a wishlist' })
  addItem(@CurrentUser() user: AuthUser, @Body() dto: AddWishlistItemDto) {
    return this.wishlist.addItem(user.id, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a wishlist item' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.wishlist.removeItem(user.id, itemId);
  }
}
