import { jest } from '@jest/globals';

const mockCreate = jest.fn<any>();

jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const { OpenAiService } = await import('./openai.service.js');

const buildReceiptData = (overrides: Record<string, string> = {}) => ({
  id_transferencia: 'E12345678901234567890123456789012',
  data_hora: '2025-01-10T14:30:00',
  valor: 'R$ 100,00',
  descricao: '',
  destino_nome: 'Maria Santos',
  destino_documento: '',
  destino_tipo_documento: '',
  destino_instituicao_bancaria: 'Itaú',
  destino_agencia: '',
  destino_conta: '',
  destino_tipo_conta: '',
  destino_chave_pix: '',
  origem_nome: 'João Silva',
  origem_documento: '123.456.789-00',
  origem_tipo_documento: 'CPF',
  origem_instituicao_bancaria: 'Nubank',
  origem_agencia: '',
  origem_conta: '',
  ...overrides,
});

describe('OpenAiService', () => {
  let service: InstanceType<typeof OpenAiService>;

  const mockConfig = {
    getOrThrow: (key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-key';
      throw new Error(`Unknown key: ${key}`);
    },
  };

  beforeEach(() => {
    mockCreate.mockReset();
    service = new OpenAiService(mockConfig as any);
  });

  describe('analyzeReceipt', () => {
    it('should parse and return valid JSON response from GPT', async () => {
      const payload = buildReceiptData();
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      });

      const result = await service.analyzeReceipt('https://cdn/img.jpg', 'ocr text');

      expect(result.id_transferencia).toBe(payload.id_transferencia);
      expect(result.valor).toBe('R$ 100,00');
    });

    it('should strip markdown code block before parsing JSON', async () => {
      const payload = buildReceiptData();
      const markdown = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: markdown } }],
      });

      const result = await service.analyzeReceipt('https://cdn/img.jpg', 'ocr text');

      expect(result.id_transferencia).toBe(payload.id_transferencia);
    });

    it('should return error object when GPT returns invalid JSON', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'isso nao e json' } }],
      });

      const result = await service.analyzeReceipt('https://cdn/img.jpg', 'ocr text');

      expect(result.error).toBe('Resposta inválida do GPT');
    });

    it('should return error object when GPT returns null content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const result = await service.analyzeReceipt('https://cdn/img.jpg', 'ocr text');

      expect(result.error).toBe('Resposta inválida do GPT');
    });

    it('should pass fileUrl and ocrText to the GPT prompt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(buildReceiptData()) } }],
      });

      await service.analyzeReceipt('https://cdn/img.jpg', 'texto ocr aqui');

      const call = mockCreate.mock.calls[0][0] as any;
      const contents = call.messages[0].content;
      expect(contents.some((c: any) => c.type === 'image_url' && c.image_url.url === 'https://cdn/img.jpg')).toBe(true);
      expect(contents.some((c: any) => c.type === 'text' && c.text.includes('texto ocr aqui'))).toBe(true);
    });
  });
});
