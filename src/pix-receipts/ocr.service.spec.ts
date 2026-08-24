import { jest } from '@jest/globals';

const mockRecognize = jest.fn<any>();
const mockAsJPEG = jest.fn<any>();
const mockToPixmap = jest.fn<any>().mockReturnValue({ asJPEG: mockAsJPEG });
const mockLoadPage = jest.fn<any>().mockReturnValue({ toPixmap: mockToPixmap });
const mockOpenDocument = jest.fn<any>().mockReturnValue({ loadPage: mockLoadPage });

jest.unstable_mockModule('tesseract.js', () => ({
  default: { recognize: mockRecognize },
}));

jest.unstable_mockModule('mupdf', () => ({
  Document: { openDocument: mockOpenDocument },
  Matrix: { identity: {} },
  ColorSpace: { DeviceRGB: {} },
}));

const { OcrService } = await import('./ocr.service.js');

const makeJpegBuffer = () => {
  const buf = Buffer.alloc(10);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
  buf[buf.length - 2] = 0xff; buf[buf.length - 1] = 0xd9;
  return buf;
};

const makePdfBuffer = () => {
  const content = '%PDF-1.4 fake pdf content';
  const buf = Buffer.alloc(content.length);
  buf.write(content, 'ascii');
  return buf;
};

describe('OcrService', () => {
  let service: InstanceType<typeof OcrService>;
  let fetchMock: jest.Mock<any>;

  beforeEach(() => {
    mockRecognize.mockReset();
    mockOpenDocument.mockClear();
    mockLoadPage.mockClear();
    mockToPixmap.mockClear();
    mockAsJPEG.mockReset();

    fetchMock = jest.fn<any>();
    global.fetch = fetchMock;

    service = new OcrService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractText', () => {
    it('should return extracted text from a valid JPEG image', async () => {
      const jpegBuffer = makeJpegBuffer();
      fetchMock.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
      });
      mockRecognize.mockResolvedValue({ data: { text: '  texto extraído  ' } });

      const result = await service.extractText('https://cdn/img.jpg');

      expect(result).toBe('texto extraído');
      expect(mockRecognize).toHaveBeenCalledWith(jpegBuffer, 'por', expect.any(Object));
    });

    it('should throw when the image is not a valid JPEG', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      fetchMock.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(invalidBuffer.buffer),
      });

      await expect(service.extractText('https://cdn/invalid.jpg'))
        .rejects.toThrow('Imagem inválida ou corrompida (esperado JPEG)');
    });
  });

  describe('pdfToJpeg', () => {
    it('should return a JPEG buffer converted from a valid PDF', async () => {
      const pdfBuffer = makePdfBuffer();
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff]);
      fetchMock.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(pdfBuffer.buffer),
      });
      mockAsJPEG.mockReturnValue(jpegBytes);

      const result = await service.pdfToJpeg('https://cdn/doc.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockOpenDocument).toHaveBeenCalled();
      expect(mockLoadPage).toHaveBeenCalledWith(0);
    });

    it('should throw when the file is not a valid PDF', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      fetchMock.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(invalidBuffer.buffer),
      });

      await expect(service.pdfToJpeg('https://cdn/invalid.pdf'))
        .rejects.toThrow('Arquivo PDF inválido ou corrompido');
    });
  });
});
