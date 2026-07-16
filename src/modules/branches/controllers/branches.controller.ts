import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BranchScope,
  BranchScopeCtx,
  isBranchAllowed,
} from '../../../common/decorators/branch-scope.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
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
  @RequirePermission('inventory.update')
  @ApiOperation({ summary: '[admin] Set stock for a (branch, variant)' })
  upsertInventory(
    @Body() dto: UpsertInventoryDto,
    @BranchScope() scope: BranchScopeCtx,
  ) {
    if (!isBranchAllowed(scope, dto.branchId)) {
      throw new ForbiddenException('Chi nhánh ngoài phạm vi của bạn');
    }
    return this.inventory.upsert(dto);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermission('inventory.create')
  @ApiOperation({ summary: '[admin] Create a branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermission('inventory.update')
  @ApiOperation({ summary: '[admin] Update a branch' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @BranchScope() scope: BranchScopeCtx,
  ) {
    if (!isBranchAllowed(scope, id)) {
      throw new ForbiddenException('Chi nhánh ngoài phạm vi của bạn');
    }
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermission('inventory.delete')
  @ApiOperation({ summary: '[admin] Delete a branch' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @BranchScope() scope: BranchScopeCtx,
  ) {
    if (!isBranchAllowed(scope, id)) {
      throw new ForbiddenException('Chi nhánh ngoài phạm vi của bạn');
    }
    return this.branches.remove(id);
  }
}
