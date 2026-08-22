import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service.js';
import { OpenAiService } from './openai.service.js';
import { PixReceiptsController } from './pix-receipts.controller.js';
import { PixReceiptsService } from './pix-receipts.service.js';
import { QueueService } from './queue.service.js';
import { StorageService } from './storage.service.js';

@Module({
  controllers: [PixReceiptsController],
  providers: [PixReceiptsService, StorageService, OcrService, OpenAiService, QueueService],
  exports: [PixReceiptsService],
})
export class PixReceiptsModule {}
