import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccountReceivableWhereInput } from '../../generated/prisma/models/AccountReceivable.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto.js';
import { AccountReceivableStatusFilter, ListAccountsReceivableQueryDto } from './dto/list-accounts-receivable-query.dto.js';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto.js';
import { UpdateInstallmentDto } from './dto/update-installment.dto.js';

@Injectable()
export class AccountsReceivableService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: ListAccountsReceivableQueryDto) {
    const { page = 1, limit = 10, status, clientId } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: AccountReceivableWhereInput = { userId };

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      if (status === AccountReceivableStatusFilter.PAID) {
        where.status = 'PAID';
      } else if (status === AccountReceivableStatusFilter.PENDING) {
        where.status = 'PENDING';
        where.dueDate = { gte: now };
      } else if (status === AccountReceivableStatusFilter.OVERDUE) {
        where.status = 'PENDING';
        where.dueDate = { lt: now };
      } else if (status === AccountReceivableStatusFilter.CANCELLED) {
        where.status = 'CANCELLED';
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.accountReceivable.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toResponse(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, userId },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        receipts: { select: { id: true, depositAmount: true, depositDateTime: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Conta a receber não encontrada');
    }

    return this.toResponse(record, record.installments, record.receipts);
  }

  async create(userId: string, dto: CreateAccountReceivableDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const installmentCount = dto.installmentCount ?? 1;

    if (installmentCount > 1) {
      const baseAmount = Math.floor((dto.totalAmount / installmentCount) * 100) / 100;
      const remainder = Math.round((dto.totalAmount - baseAmount * installmentCount) * 100) / 100;
      const baseDate = new Date(dto.dueDate);

      const record = await this.prisma.accountReceivable.create({
        data: {
          userId,
          clientId: dto.clientId,
          clientName: client.name,
          serviceName: dto.serviceName,
          serviceDescription: dto.serviceDescription ?? null,
          totalAmount: dto.totalAmount,
          status: 'PENDING',
          dueDate: baseDate,
          payStub: dto.payStub ?? null,
          installments: {
            create: Array.from({ length: installmentCount }, (_, i) => {
              const dueDate = new Date(baseDate);
              dueDate.setMonth(dueDate.getMonth() + i);
              const isLast = i === installmentCount - 1;
              return {
                installmentNumber: i + 1,
                amount: isLast ? baseAmount + remainder : baseAmount,
                dueDate,
              };
            }),
          },
        },
        include: {
          installments: { orderBy: { installmentNumber: 'asc' } },
        },
      });

      return this.toResponse(record, record.installments);
    }

    const record = await this.prisma.accountReceivable.create({
      data: {
        userId,
        clientId: dto.clientId,
        clientName: client.name,
        serviceName: dto.serviceName,
        serviceDescription: dto.serviceDescription ?? null,
        totalAmount: dto.totalAmount,
        status: 'PENDING',
        dueDate: new Date(dto.dueDate),
        payStub: dto.payStub ?? null,
      },
    });

    return this.toResponse(record);
  }

  async update(userId: string, id: string, dto: UpdateAccountReceivableDto) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, userId },
      include: { installments: true },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    if (record.status === 'PAID') {
      throw new BadRequestException('Cannot update a paid account receivable');
    }

    if (record.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled account receivable');
    }

    if (dto.totalAmount !== undefined && record.installments.length > 0) {
      const unpaid = record.installments.filter((i) => i.paidAt === null);
      if (unpaid.length > 0) {
        const paidTotal = record.installments
          .filter((i) => i.paidAt !== null)
          .reduce((sum, i) => sum + Number(i.amount), 0);

        if (dto.totalAmount < paidTotal) {
          throw new BadRequestException(`Total amount cannot be less than the already paid amount (R$ ${paidTotal.toFixed(2)})`);
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accountReceivable.update({
        where: { id },
        data: {
          ...(dto.serviceName !== undefined && { serviceName: dto.serviceName }),
          ...(dto.serviceDescription !== undefined && { serviceDescription: dto.serviceDescription }),
          ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
          ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
          ...(dto.paidAt !== undefined && {
            paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
            status: dto.paidAt ? 'PAID' : 'PENDING',
          }),
          ...(dto.payStub !== undefined && { payStub: dto.payStub }),
        },
      });

      if (dto.totalAmount !== undefined && record.installments.length > 0) {
        const unpaid = record.installments.filter((i) => i.paidAt === null);
        if (unpaid.length > 0) {
          const paidTotal = record.installments
            .filter((i) => i.paidAt !== null)
            .reduce((sum, i) => sum + Number(i.amount), 0);

          const remaining = Math.round((dto.totalAmount - paidTotal) * 100) / 100;
          const baseAmount = Math.floor((remaining / unpaid.length) * 100) / 100;
          const remainder = Math.round((remaining - baseAmount * unpaid.length) * 100) / 100;

          await Promise.all(
            unpaid.map((inst, i) =>
              tx.installment.update({
                where: { id: inst.id },
                data: { amount: i === unpaid.length - 1 ? baseAmount + remainder : baseAmount },
              }),
            ),
          );
        }
      }

      if (dto.paidAt !== undefined && record.installments.length > 0) {
        const syncedPaidAt = dto.paidAt ? new Date(dto.paidAt) : null;
        await tx.installment.updateMany({
          where: { accountReceivableId: id },
          data: { paidAt: syncedPaidAt },
        });
      }
    });

    const result = await this.prisma.accountReceivable.findFirst({
      where: { id },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    return this.toResponse(result!, result!.installments);
  }

  async markInstallmentAsPaid(userId: string, accountReceivableId: string, installmentId: string) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId, userId },
      include: { installments: true },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    const installment = record.installments.find((i) => i.id === installmentId);
    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    if (installment.paidAt) {
      throw new BadRequestException('Installment is already paid');
    }

    const now = new Date();
    const allPaid = record.installments.every((i) => i.id === installmentId || i.paidAt !== null);

    await this.prisma.$transaction(async (tx) => {
      await tx.installment.update({
        where: { id: installmentId },
        data: { paidAt: now },
      });

      if (allPaid) {
        await tx.accountReceivable.update({
          where: { id: accountReceivableId },
          data: { paidAt: now, status: 'PAID' },
        });
      }
    });

    const updated = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    return this.toResponse(updated!, updated!.installments);
  }

  async markAllInstallmentsAsPaid(userId: string, accountReceivableId: string) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId, userId },
      include: { installments: true },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    const allAlreadyPaid = record.installments.every((i) => i.paidAt !== null);
    if (allAlreadyPaid) {
      throw new BadRequestException('All installments are already paid');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.installment.updateMany({
        where: { accountReceivableId, paidAt: null },
        data: { paidAt: now },
      }),
      this.prisma.accountReceivable.update({
        where: { id: accountReceivableId },
        data: { paidAt: now, status: 'PAID' },
      }),
    ]);

    const updated = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    return this.toResponse(updated!, updated!.installments);
  }

  async updateInstallment(userId: string, accountReceivableId: string, installmentId: string, dto: UpdateInstallmentDto) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId, userId },
      include: { installments: true },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    const installment = record.installments.find((i) => i.id === installmentId);
    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    if (installment.paidAt) {
      throw new BadRequestException('Cannot edit a paid installment');
    }

    const updates: { amount?: number; dueDate?: Date } = {};

    if (dto.dueDate !== undefined) {
      updates.dueDate = new Date(dto.dueDate);
    }

    let redistribution: Array<{ id: string; amount: number }> = [];

    if (dto.amount !== undefined) {
      updates.amount = dto.amount;

      const totalAmount = Number(record.totalAmount);
      const paidTotal = record.installments
        .filter((i) => i.paidAt !== null && i.id !== installmentId)
        .reduce((sum, i) => sum + Number(i.amount), 0);

      const remaining = Math.round((totalAmount - paidTotal - dto.amount) * 100) / 100;
      const othersUnpaid = record.installments.filter((i) => i.paidAt === null && i.id !== installmentId);

      if (othersUnpaid.length > 0) {
        if (remaining <= 0) {
          throw new BadRequestException('Installment amount exceeds the remaining balance');
        }

        const baseAmount = Math.floor((remaining / othersUnpaid.length) * 100) / 100;
        const remainder = Math.round((remaining - baseAmount * othersUnpaid.length) * 100) / 100;

        redistribution = othersUnpaid.map((inst, i) => ({
          id: inst.id,
          amount: i === othersUnpaid.length - 1 ? baseAmount + remainder : baseAmount,
        }));
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        redistribution.map((inst) =>
          tx.installment.update({ where: { id: inst.id }, data: { amount: inst.amount } }),
        ),
      );

      await tx.installment.update({ where: { id: installmentId }, data: updates });
    });

    const updated = await this.prisma.accountReceivable.findFirst({
      where: { id: accountReceivableId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    return this.toResponse(updated!, updated!.installments);
  }

  async cancel(userId: string, id: string) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    if (record.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a paid account receivable');
    }

    if (record.status === 'CANCELLED') {
      throw new BadRequestException('Account receivable is already cancelled');
    }

    const reconciledReceipts = await this.prisma.pixReceipt.count({
      where: { accountReceivableId: id },
    });

    if (reconciledReceipts > 0) {
      throw new BadRequestException(
        'Existem comprovantes reconciliados com esta conta. Desconcilie-os antes de cancelar.',
      );
    }

    const updated = await this.prisma.accountReceivable.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return this.toResponse(updated);
  }

  private toInstallmentResponse(inst: {
    id: string;
    installmentNumber: number;
    amount: unknown;
    dueDate: Date;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const now = new Date();
    let status: string;
    if (inst.paidAt) {
      status = 'PAID';
    } else if (inst.dueDate < now) {
      status = 'OVERDUE';
    } else {
      status = 'PENDING';
    }
    return { ...inst, amount: Number(inst.amount), status };
  }

  private toResponse(
    record: {
      id: string;
      userId: string;
      clientId: string;
      clientName: string;
      serviceName: string;
      serviceDescription: string | null;
      totalAmount: unknown;
      dueDate: Date;
      status: string;
      paidAt: Date | null;
      payStub: string | null;
      matchedAutomatically: boolean | null;
      createdAt: Date;
      updatedAt: Date;
    },
    installments?: {
      id: string;
      installmentNumber: number;
      amount: unknown;
      dueDate: Date;
      paidAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }[],
    receipts?: { id: string; depositAmount: unknown; depositDateTime: Date | null }[],
  ) {
    const now = new Date();
    let computedStatus = record.status;
    if (record.status === 'PENDING' && record.dueDate < now) {
      computedStatus = 'OVERDUE';
    }

    const base = {
      ...record,
      totalAmount: Number(record.totalAmount),
      status: computedStatus,
    };

    return {
      ...base,
      ...(installments !== undefined && { installments: installments.map((i) => this.toInstallmentResponse(i)) }),
      ...(receipts !== undefined && {
        receipts: receipts.map((r) => ({ ...r, depositAmount: r.depositAmount !== null ? Number(r.depositAmount) : null })),
      }),
    };
  }
}
