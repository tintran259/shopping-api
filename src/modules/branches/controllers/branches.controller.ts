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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateBranchDto, UpdateBranchDto } from '../dto/branch.dto';
import { UpsertInventoryDto } from '../dto/inventory.dto';
import { BranchesService } from '../services/branches.service';
import { InventoryService } from '../services/inventory.service';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branches: BranchesService,
    private readonly inventory: InventoryService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active branches (for the branch picker)' })
  findAll() {
    return this.branches.findAll();
  }

  @Public()
  @Get('inventory/variant/:variantId')
  @ApiOperation({ summary: 'Per-branch stock for a variant (BranchStock[])' })
  variantStock(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventory.findForVariant(variantId);
  }

  @Put('inventory')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Set stock for a (branch, variant)' })
  upsertInventory(@Body() dto: UpsertInventoryDto) {
    return this.inventory.upsert(dto);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Create a branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Update a branch' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Delete a branch' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branches.remove(id);
  }
}
