import { InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ZapfyClient } from './zapfy.client.js';

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('https://api.zapfy.com'),
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
        buildOkResponse({ result: { qrCode: 'data:image/png;base64,abc', state: 'open' }, isValid: true }),
      );

      const result = await client.getQrCode('my-key', 'my-token');

      expect(result).toEqual({ qrCode: 'data:image/png;base64,abc', state: 'open' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/my-key/token/my-token/connect'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return null qrCode when API does not return one', async () => {
      fetchSpy.mockResolvedValue(
        buildOkResponse({ result: { state: 'close' }, isValid: true }),
      );

      const result = await client.getQrCode('my-key', 'my-token');

      expect(result).toEqual({ qrCode: null, state: 'close' });
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.getQrCode('my-key', 'my-token')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(500, 'Internal error'));

      await expect(client.getQrCode('my-key', 'my-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('disconnect', () => {
    it('should resolve without error on success', async () => {
      fetchSpy.mockResolvedValue(buildOkResponse({}));

      await expect(client.disconnect('my-key', 'my-token')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/my-key/token/my-token/disconnect'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.disconnect('my-key', 'my-token')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(503, 'Service unavailable'));

      await expect(client.disconnect('my-key', 'my-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getState', () => {
    it('should return state on success', async () => {
      fetchSpy.mockResolvedValue(
        buildOkResponse({ result: { state: 'open' }, isValid: true }),
      );

      const result = await client.getState('my-key', 'my-token');

      expect(result).toEqual({ state: 'open' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/my-key/token/my-token/getState'),
      );
    });

    it('should throw UnprocessableEntityException on 401', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(401));

      await expect(client.getState('my-key', 'my-token')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      fetchSpy.mockResolvedValue(buildErrorResponse(404, 'Not found'));

      await expect(client.getState('my-key', 'my-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
