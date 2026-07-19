import { Module } from '@nestjs/common';
import { AdminUploadsController } from './controllers/admin-uploads.controller';
import { ReviewUploadsController } from './controllers/review-uploads.controller';

@Module({
  controllers: [AdminUploadsController, ReviewUploadsController],
})
export class UploadsModule {}
