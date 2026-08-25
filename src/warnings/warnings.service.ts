import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WarningTypeFilter } from './dto/list-warnings-query.dto.js';

@Injectable()
export class WarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20, type?: WarningTypeFilter) {
    page = Math.max(1, page);
    limit = Math.max(1, Math.min(limit, 100));

    const baseWhere = {
      pixReceipt: { userId },
      OR: [{ resolved: null }, { resolved: false }],
    };

    const filteredWhere = type ? { ...baseWhere, type } : baseWhere;

    const [data, total, yellowCount, redCount] = await this.prisma.$transaction([
      this.prisma.warning.findMany({
        where: filteredWhere,
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.warning.count({ where: filteredWhere }),
      this.prisma.warning.count({ where: { ...baseWhere, type: 'yellow' } }),
      this.prisma.warning.count({ where: { ...baseWhere, type: 'red' } }),
    ]);

    return { data, total, yellowCount, redCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async resolve(userId: string, warningId: string, resolutionReason: string) {
    const warning = await this.prisma.warning.findFirst({
      where: { id: warningId, pixReceipt: { userId } },
      include: { pixReceipt: true },
    });
    if (!warning) throw new NotFoundException('Alerta não encontrado');
    if (warning.resolved) throw new BadRequestException('Alerta já foi resolvido');

    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.warning.update({
        where: { id: warningId },
        data: { resolved: true, resolvedAt: new Date(), resolutionReason },
      });

      const receipt = warning.pixReceipt;
      if (receipt.status === 'RED_FLAG' || receipt.status === 'YELLOW_FLAG') {
        const remaining = await tx.warning.findMany({
          where: { pixReceiptId: receipt.id, id: { not: warningId }, OR: [{ resolved: null }, { resolved: false }] },
          select: { type: true },
        });

        const hasRed = remaining.some((w) => w.type === 'red');
        const hasYellow = remaining.some((w) => w.type === 'yellow');
        const newStatus = hasRed ? 'RED_FLAG' : hasYellow ? 'YELLOW_FLAG' : 'RECEIVED';

        if (newStatus !== receipt.status) {
          await tx.pixReceipt.update({ where: { id: receipt.id }, data: { status: newStatus } });
        }
      }

      return resolved;
    });
  }
}
