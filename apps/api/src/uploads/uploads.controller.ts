import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  extensionForMime,
  isAllowedUploadMime,
  MAX_UPLOAD_BYTES,
  UPLOADS_DIR,
} from './uploads.constants';

@Controller('uploads')
@UseGuards(BootstrapAuthGuard)
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extensionForMime(file.mimetype)}`);
        },
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!isAllowedUploadMime(file.mimetype)) {
          cb(
            new BadRequestException(
              `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return { url: `/static/${file.filename}` };
  }
}
