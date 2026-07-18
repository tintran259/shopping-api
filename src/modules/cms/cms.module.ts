import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

/** CMS (Strapi) auto-login bridge — mints a shared admin JWT for the BO. */
@Module({
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
