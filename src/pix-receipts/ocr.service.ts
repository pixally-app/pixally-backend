import { Injectable, Logger } from '@nestjs/common';
import Tesseract from 'tesseract.js';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(imageUrl: string): Promise<string> {
    this.logger.log(`Iniciando OCR para: ${imageUrl}`);

    const result = await Tesseract.recognize(imageUrl, 'por', {
      logger: () => {},
    });

    const text = result.data.text.trim();
    this.logger.log(`OCR concluído — ${text.length} caracteres extraídos`);

    return text;
  }
}
