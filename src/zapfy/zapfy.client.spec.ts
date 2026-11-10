import { InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ZapfyClient } from './zapfy.client.js';

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'EVOLUTION_SERVER_URL') return 'http://localhost:8080';
    if (key === 'EVOLUTION_API_KEY') return 'test-api-key';
    return '';
  }),
};

const buildOkResponse = (body: unknown) =>
  ({ ok: true, json: async () => body, text: async () => '' }) as unknown as Response;

const buildErrorResponse = (status: number, body = 'error') =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;

describe('ZapfyClient', () => {
  let client: ZapfyClient;
  let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

  beforeAll(() => {
    client = new ZapfyClient(mockConfigService as any);
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getQrCode', () => {
    it('should return qrCode and state on success', async () => {
      fetchSpy.mockResolvedValue(
        buildOkResponse({ base64: 'data:image/png;base64,abc', code: '2@xyz' }),
      );

      const result = await client.getQrCode('my-instance');

      expect(result).toEqual({ qrCode: 'data:image/png;base64,abc', state: 'connecting' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/instance/connect/my-instance'),
        expect.objectContaining({ headers: expect.objectContaining({ apikey: 'test-api-key' }) }),
      );
    });

    it('should return null qrCode when already connected', async () => {
      fetchSpy.mockResolvedValue(buildOkResponse({}));

      const result = await client.getQrCode('my-instance');

      expect(result).toEqual({ qrCode: null, state: 'open' });
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.getQrCode('my-instance')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(500, 'Internal error'));

      await expect(client.getQrCode('my-instance')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('disconnect', () => {
    it('should resolve without error on success', async () => {
      fetchSpy.mockResolvedValue(buildOkResponse({}));

      await expect(client.disconnect('my-instance')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/instance/logout/my-instance'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.disconnect('my-instance')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(503, 'Service unavailable'));

      await expect(client.disconnect('my-instance')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getState', () => {
    it('should return state on success', async () => {
      fetchSpy.mockResolvedValue(
        buildOkResponse({ instance: { state: 'open' } }),
      );

      const result = await client.getState('my-instance');

      expect(result).toEqual({ state: 'open' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/instance/connectionState/my-instance'),
        expect.anything(),
      );
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.getState('my-instance')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(404, 'Not found'));

      await expect(client.getState('my-instance')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
