import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockSendMail = jest.fn<() => Promise<unknown>>();
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
}));

const { EmailService } = await import('./email.service.js');

describe('EmailService', () => {
  let service: InstanceType<typeof EmailService>;
  let configGetMock: jest.Mock;

  beforeEach(async () => {
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();

    configGetMock = jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'test-smtp-pass',
        APP_URL: 'http://localhost:3000',
        SMTP_FROM: 'noreply@pixcheck.com',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: { get: configGetMock },
        },
      ],
    }).compile();

    service = module.get<InstanceType<typeof EmailService>>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should create nodemailer transporter with config values', () => {
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        auth: {
          user: 'user@example.com',
          pass: 'test-smtp-pass',
        },
      });
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('should call sendMail with correct parameters', async () => {
      mockSendMail.mockResolvedValueOnce({});

      await service.sendResetPasswordEmail('dest@example.com', 'token-abc');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@pixcheck.com',
        to: 'dest@example.com',
        subject: 'Recuperação de Senha - Pixally',
        html: expect.stringContaining('http://localhost:3000/reset-password?token=token-abc'),
      });
    });

    it('should build reset link with APP_URL and token', async () => {
      mockSendMail.mockResolvedValueOnce({});

      await service.sendResetPasswordEmail('user@test.com', 'my-token');

      const call = (mockSendMail.mock.calls[0] as any[])[0];
      expect(call.html).toContain('http://localhost:3000/reset-password?token=my-token');
    });

    it('should use default APP_URL when not configured', async () => {
      configGetMock.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'APP_URL') return defaultValue;
        const config: Record<string, string> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '587',
          SMTP_USER: 'user@example.com',
          SMTP_PASS: 'test-smtp-pass',
          SMTP_FROM: 'noreply@pixcheck.com',
        };
        return config[key] ?? defaultValue;
      });

      mockSendMail.mockResolvedValueOnce({});

      await service.sendResetPasswordEmail('user@test.com', 'tok');

      const call = (mockSendMail.mock.calls[0] as any[])[0];
      expect(call.html).toContain('http://localhost:3000/reset-password?token=tok');
    });

    it('should use default SMTP_FROM when not configured', async () => {
      configGetMock.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'SMTP_FROM') return defaultValue;
        const config: Record<string, string> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '587',
          SMTP_USER: 'user@example.com',
          SMTP_PASS: 'test-smtp-pass',
          APP_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue;
      });

      mockSendMail.mockResolvedValueOnce({});

      await service.sendResetPasswordEmail('user@test.com', 'tok');

      const call = (mockSendMail.mock.calls[0] as any[])[0];
      expect(call.from).toBe('noreply@pixcheck.com');
    });

    it('should propagate error when sendMail fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      await expect(
        service.sendResetPasswordEmail('user@test.com', 'tok'),
      ).rejects.toThrow('SMTP connection refused');
    });
  });
});
