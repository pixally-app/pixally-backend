import { Injectable, Logger } from '@nestjs/common';
import * as mupdf from 'mupdf';
import Tesseract from 'tesseract.js';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(imageUrl: string): Promise<string> {
    this.logger.log(`Iniciando OCR para: ${imageUrl}`);

    const res = await fetch(imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());

    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
      && buffer[buffer.length - 2] === 0xFF && buffer[buffer.length - 1] === 0xD9;

    if (!isJpeg) {
      throw new Error('Imagem inválida ou corrompida (esperado JPEG)');
    }

    const result = await Tesseract.recognize(buffer, 'por', {
      logger: () => {},
    });

    const text = result.data.text.trim();
    this.logger.log(`OCR concluído — ${text.length} caracteres extraídos`);

    return text;
  }

  async pdfToJpeg(pdfUrl: string): Promise<Buffer> {
    this.logger.log(`Convertendo PDF para JPEG: ${pdfUrl}`);

    const res = await fetch(pdfUrl);
    const buffer = Buffer.from(await res.arrayBuffer());

    const isPdf = buffer.subarray(0, 4).toString('ascii') === '%PDF';
    if (!isPdf) {
      throw new Error('Arquivo PDF inválido ou corrompido');
    }

    const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    const page = doc.loadPage(0);
    const pixmap = page.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false, true);
    const jpeg = Buffer.from(pixmap.asJPEG(90));

    this.logger.log(`PDF convertido — ${jpeg.length} bytes`);

    return jpeg;
  }
}
