import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT')),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendResetPasswordEmail(to: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', 'noreply@pixcheck.com'),
      to,
      subject: 'Recuperação de Senha - Pixally',
      html: `
        <h2>Recuperação de Senha</h2>
        <p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir sua senha:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este link expira em 1 hora.</p>
        <p>Se você não solicitou essa recuperação, ignore este email.</p>
      `,
    });
  }
}