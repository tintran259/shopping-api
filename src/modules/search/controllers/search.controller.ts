import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { SearchService } from '../services/search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search suggestions (typeahead): products + categories',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search term (>= 2 chars)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  suggest(
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.search.suggest(q ?? '', limit);
  }
}
