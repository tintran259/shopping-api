import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerRole } from '../../../common/enums';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { LocationsService } from '../services/locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Public()
  @Get('provinces')
  @ApiOperation({ summary: 'List provinces (2025 2-tier model)' })
  provinces() {
    return this.locations.listProvinces();
  }

  @Public()
  @Get('provinces/:code/wards')
  @ApiOperation({ summary: 'List wards of a province' })
  wards(@Param('code', ParseIntPipe) code: number) {
    return this.locations.listWards(code);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({ summary: '[admin] Import latest administrative data into the DB' })
  sync() {
    return this.locations.syncFromOpenApi();
  }
}
