import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CmsService } from './cms.service';

/**
 * CMS auto-login bridge for the Back Office. `cms.view` = được mở & đăng nhập
 * sẵn vào admin CMS (Strapi) từ BO. Token tạo đúng lúc bấm nav, không lưu ở BO.
 */
@ApiTags('admin-cms')
@ApiBearerAuth()
@Controller('admin/cms')
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Post('login-token')
  @HttpCode(200)
  @RequirePermission('cms.view')
  @ApiOperation({ summary: 'Cấp token admin CMS để BO auto-login (mở tab CMS)' })
  loginToken() {
    return this.cms.getLoginToken();
  }
}
