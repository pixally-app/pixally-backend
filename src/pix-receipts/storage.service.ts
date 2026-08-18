import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
    this.bucket = config.getOrThrow('SUPABASE_BUCKET');
  }

  async upload(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const filename = `${randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filename, buffer, { contentType: mimeType });

    if (error) {
      this.logger.error(`Erro ao fazer upload para o Supabase: ${error.message}`);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(filename);
    return data.publicUrl;
  }

  async delete(fileUrl: string): Promise<void> {
    const filename = fileUrl.split('/').pop();
    if (!filename) return;

    const { error } = await this.supabase.storage.from(this.bucket).remove([filename]);

    if (error) {
      this.logger.warn(`Erro ao deletar arquivo do Supabase: ${error.message}`);
    }
  }
}
