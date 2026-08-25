import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [receivedThisMonth, totalPending, totalOverdue, processedThisMonth] =
      await this.prisma.$transaction([
        this.prisma.pixReceipt.aggregate({
          where: {
            userId,
            status: { in: ['RECEIVED', 'RECONCILED'] },
            depositDateTime: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { depositAmount: true },
        }),
        this.prisma.accountReceivable.aggregate({
          where: { userId, status: 'PENDING', dueDate: { gte: now } },
          _sum: { totalAmount: true },
        }),
        this.prisma.accountReceivable.aggregate({
          where: { userId, status: 'PENDING', dueDate: { lt: now } },
          _sum: { totalAmount: true },
        }),
        this.prisma.pixReceipt.count({
          where: {
            userId,
            status: { notIn: ['ANALYSING', 'ERROR'] },
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
      ]);

    return {
      receivedThisMonth: Number(receivedThisMonth._sum.depositAmount ?? 0),
      totalPending: Number(totalPending._sum.totalAmount ?? 0),
      totalOverdue: Number(totalOverdue._sum.totalAmount ?? 0),
      processedThisMonth,
    };
  }

  async getGraphic(userId: string) {
    const now = new Date();
    const startOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const receipts = await this.prisma.pixReceipt.findMany({
      where: {
        userId,
        status: { notIn: ['ANALYSING', 'ERROR'] },
        depositDateTime: { gte: startOfRange },
      },
      select: { depositDateTime: true, depositAmount: true },
    });

    const result: { date: string; valor: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const dateLabel = `${String(dayStart.getDate()).padStart(2, '0')}/${String(dayStart.getMonth() + 1).padStart(2, '0')}`;

      const valor = receipts
        .filter((r) => r.depositDateTime && r.depositDateTime >= dayStart && r.depositDateTime < dayEnd)
        .reduce((sum, r) => sum + Number(r.depositAmount ?? 0), 0);

      result.push({ date: dateLabel, valor });
    }

    return result;
  }
}
