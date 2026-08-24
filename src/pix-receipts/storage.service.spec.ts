import { jest } from '@jest/globals';

const mockUpload = jest.fn<any>();
const mockRemove = jest.fn<any>();
const mockGetPublicUrl = jest.fn<any>();
const mockFrom = jest.fn().mockReturnValue({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
});

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    storage: { from: mockFrom },
  }),
}));

const { StorageService } = await import('./storage.service.js');

describe('StorageService', () => {
  let service: InstanceType<typeof StorageService>;

  const mockConfig = {
    getOrThrow: (key: string) => {
      const config: Record<string, string> = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_BUCKET: 'test-bucket',
      };
      if (key in config) return config[key];
      throw new Error(`Unknown config key: ${key}`);
    },
  };

  beforeEach(() => {
    mockUpload.mockReset();
    mockRemove.mockReset();
    mockGetPublicUrl.mockReset();
    service = new StorageService(mockConfig as any);
  });

  describe('upload', () => {
    it('should return path and url on successful jpeg upload', async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.supabase.co/file.jpg' } });

      const result = await service.upload(Buffer.from('img'), 'image/jpeg');

      expect(result.path).toMatch(/\.jpg$/);
      expect(result.url).toBe('https://cdn.supabase.co/file.jpg');
    });

    it('should use pdf extension for application/pdf mimeType', async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.supabase.co/file.pdf' } });

      const result = await service.upload(Buffer.from('pdf'), 'application/pdf');

      expect(result.path).toMatch(/\.pdf$/);
    });

    it('should call supabase storage from the configured bucket', async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/file.jpg' } });

      await service.upload(Buffer.from('img'), 'image/jpeg');

      expect(mockFrom).toHaveBeenCalledWith('test-bucket');
    });

    it('should throw when Supabase returns an upload error', async () => {
      mockUpload.mockResolvedValue({ error: { message: 'quota exceeded' } });

      await expect(service.upload(Buffer.from('img'), 'image/jpeg'))
        .rejects.toThrow('Storage upload failed: quota exceeded');
    });
  });

  describe('delete', () => {
    it('should call remove with the filename extracted from the url', async () => {
      mockRemove.mockResolvedValue({ error: null });

      await service.delete('https://cdn.supabase.co/storage/v1/object/public/bucket/abc123.jpg');

      expect(mockRemove).toHaveBeenCalledWith(['abc123.jpg']);
    });

    it('should not throw when Supabase returns a delete error', async () => {
      mockRemove.mockResolvedValue({ error: { message: 'file not found' } });

      await expect(service.delete('https://cdn/abc123.jpg')).resolves.toBeUndefined();
    });

    it('should return early without calling remove when url is empty', async () => {
      await service.delete('');

      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
