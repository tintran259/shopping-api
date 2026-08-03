import { Module } from '@nestjs/common';
import { AdminUploadsController } from './controllers/admin-uploads.controller';
import { ReviewUploadsController } from './controllers/review-uploads.controller';
import { ImageGenService } from './services/image-gen.service';

@Module({
  controllers: [AdminUploadsController, ReviewUploadsController],
  providers: [ImageGenService],
})
export class UploadsModule {}
