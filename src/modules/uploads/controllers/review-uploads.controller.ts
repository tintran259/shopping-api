import { randomBytes } from 'crypto';
import { extname } from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = /^image\/(jpeg|png|webp|avif)$/;

/** Authenticated (any user) upload for review/feedback images. */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads/review-images')
export class ReviewUploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post()
  @ApiOperation({ summary: 'Upload up to 5 review images (multipart field: files)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const name = `rv-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}${extname(file.originalname).toLowerCase()}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED.test(file.mimetype)) {
          return cb(
            new BadRequestException('Chỉ chấp nhận ảnh JPEG/PNG/WebP/AVIF.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ): { urls: string[] } {
    if (!files?.length) {
      throw new BadRequestException('Chưa chọn tệp ảnh nào.');
    }
    const base =
      this.config.get<string>('publicUrl') ||
      `${req.protocol}://${req.get('host')}`;
    return { urls: files.map((f) => `${base}/uploads/${f.filename}`) };
  }
}
