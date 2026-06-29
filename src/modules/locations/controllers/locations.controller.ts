import {
  Controller,
  Get,
  Header,
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

/** Administrative data is effectively static — cache hard at the edge/browser. */
const LOCATION_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Public()
  @Get('provinces')
  @Header('Cache-Control', LOCATION_CACHE)
  @ApiOperation({ summary: 'List provinces (2025 2-tier model)' })
  provinces() {
    return this.locations.listProvinces();
  }

  @Public()
  @Get('provinces/:code/wards')
  @Header('Cache-Control', LOCATION_CACHE)
  @ApiOperation({ summary: 'List wards of a province' })
  wards(@Param('code', ParseIntPipe) code: number) {
    return this.locations.listWards(code);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(CustomerRole.ADMIN)
  @ApiOperation({
    summary: '[admin] Import latest administrative data into the DB',
  })
  sync() {
    return this.locations.syncFromOpenApi();
  }
}
