import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PostingController } from './posting.controller';
import { PostingPreviewController } from './posting-preview.controller';
import { PostingPreviewService } from './posting-preview.service';
import { PostingService } from './posting.service';

@Module({
  controllers: [PostingController, PostingPreviewController],
  imports: [PrismaModule],
  providers: [PostingPreviewService, PostingService],
})
export class PostingModule {}
