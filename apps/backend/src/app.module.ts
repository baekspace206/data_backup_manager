import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from './uploads/uploads.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    UploadsModule,
    StorageModule
  ]
})
export class AppModule {}