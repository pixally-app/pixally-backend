import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs: Array<() => Promise<void>> = [];
  private running = 0;
  private readonly concurrency = 3;

  enqueue(job: () => Promise<void>): void {
    this.jobs.push(job);
    this.tick();
  }

  private tick(): void {
    if (this.running >= this.concurrency || this.jobs.length === 0) return;
    const job = this.jobs.shift()!;
    this.running++;
    job().finally(() => {
      this.running--;
      this.tick();
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.running === 0) return;
    this.logger.log(`Aguardando ${this.running} jobs finalizarem antes de encerrar`);
    while (this.running > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    this.logger.log('Todos os jobs finalizados.');
  }
}
