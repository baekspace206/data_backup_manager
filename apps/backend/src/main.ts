import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS 설정 (React 개발 서버용)
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'], // React dev server
    credentials: true
  }));
  
  // 전역 validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true
  }));
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 SaveMyData Backend running on http://localhost:${port}`);
}

bootstrap();