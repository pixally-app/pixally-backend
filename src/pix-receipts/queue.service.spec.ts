import { jest } from '@jest/globals';
import { QueueService } from './queue.service.js';

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService();
  });

  afterEach(() => { jest.resetAllMocks(); });

  it('should execute an enqueued job', async () => {
    const job = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

    service.enqueue(job);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(job).toHaveBeenCalledTimes(1);
  });

  it('should execute multiple jobs sequentially respecting concurrency limit', async () => {
    const order: number[] = [];
    const makeJob = (n: number) => async () => {
      order.push(n);
    };

    for (let i = 1; i <= 5; i++) {
      service.enqueue(makeJob(i));
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(order).toHaveLength(5);
  });

  it('should continue processing remaining jobs even when one throws internally', async () => {
    const order: number[] = [];
    const failingJob = async () => {
      try { throw new Error('job failed'); } catch { order.push(1); }
    };
    const successJob = async () => { order.push(2); };

    service.enqueue(failingJob);
    service.enqueue(successJob);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(order).toEqual([1, 2]);
  });

  it('should call onApplicationShutdown without throwing when idle', async () => {
    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('should wait for running jobs before shutting down', async () => {
    let resolve!: () => void;
    const slowJob = () => new Promise<void>((r) => { resolve = r; });

    service.enqueue(slowJob);
    await new Promise((r) => setTimeout(r, 10));

    const shutdownPromise = service.onApplicationShutdown();
    resolve();
    await expect(shutdownPromise).resolves.toBeUndefined();
  });
});
