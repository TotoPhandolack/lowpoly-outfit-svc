import { Module } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { CloudinaryService } from './cloudinary.service';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  controllers: [ModelsController],
  providers: [AdminTokenGuard, CloudinaryService, ModelsService],
})
export class ModelsModule {}
