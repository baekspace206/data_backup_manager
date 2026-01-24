import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // 메모리에 저장하여 직접 처리
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
        files: 10 // 최대 10개 파일
      },
      fileFilter: (req, file, callback) => {
        // 다양한 인코딩 방식으로 파일명 복구 시도
        try {
          // 1. 이미 UTF-8인지 확인
          if (!/[\u0000-\u001F\u007F-\u009F]/.test(file.originalname)) {
            // 정상적인 문자열인 경우 그대로 사용
          } else {
            // 2. latin1 → UTF-8 변환 시도
            const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
            if (/[\u3131-\u318E\uAC00-\uD7A3]/.test(decoded)) {
              file.originalname = decoded;
            } else {
              // 3. 다른 인코딩 시도 (Base64, percent encoding 등)
              const urlDecoded = decodeURIComponent(escape(file.originalname));
              if (/[\u3131-\u318E\uAC00-\uD7A3]/.test(urlDecoded)) {
                file.originalname = urlDecoded;
              }
            }
          }
        } catch (e) {
          console.log('Filename encoding failed, using original:', file.originalname);
        }
        
        const allowedMimeTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
          'video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/x-msvideo'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
      }
    }),
    StorageModule
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService]
})
export class UploadsModule {}