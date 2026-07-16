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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

const MAX_FILES = 10;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB / file
const ALLOWED = /^image\/(jpeg|png|webp|gif|avif)$/;

/**
 * Back-office image upload (product photos…). Files land in `./uploads`, which
 * `main.ts` serves statically at `/uploads/*` (outside the API prefix). The
 * response returns absolute URLs, so what the BO stores on a product is exactly
 * what the storefront can render.
 */
@ApiTags('admin/uploads')
@ApiBearerAuth()
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post()
  @RequirePermission('catalog.create', 'catalog.update')
  @ApiOperation({ summary: 'Upload up to 10 images (multipart field: files)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${extname(file.originalname).toLowerCase()}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED.test(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận ảnh JPEG/PNG/WebP/GIF/AVIF.',
            ),
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
