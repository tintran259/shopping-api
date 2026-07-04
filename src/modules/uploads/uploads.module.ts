import { Module } from '@nestjs/common';
import { AdminUploadsController } from './controllers/admin-uploads.controller';

@Module({
  controllers: [AdminUploadsController],
})
export class UploadsModule {}
