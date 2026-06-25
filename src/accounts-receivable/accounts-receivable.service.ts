import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountReceivableWhereInput } from '../../generated/prisma/models/AccountReceivable.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto.js';
import { AccountReceivableStatusFilter, ListAccountsReceivableQueryDto } from './dto/list-accounts-receivable-query.dto.js';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto.js';

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
      },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    return this.toResponse(record, record.installments);
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
      const installmentAmount = dto.totalAmount / installmentCount;
      const baseDate = new Date(dto.dueDate);

      const record = await this.prisma.accountReceivable.create({
        data: {
          userId,
          clientId: dto.clientId,
          pixReceiptId: dto.pixReceiptId ?? null,
          clientName: client.name,
          serviceName: dto.serviceName ?? null,
          serviceDescription: dto.serviceDescription ?? null,
          totalAmount: dto.totalAmount,
          status: 'PENDING',
          dueDate: baseDate,
          payStub: dto.payStub ?? null,
          installments: {
            create: Array.from({ length: installmentCount }, (_, i) => {
              const dueDate = new Date(baseDate);
              dueDate.setMonth(dueDate.getMonth() + i);
              return {
                installmentNumber: i + 1,
                amount: installmentAmount,
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
        pixReceiptId: dto.pixReceiptId ?? null,
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
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    const updated = await this.prisma.accountReceivable.update({
      where: { id },
      data: {
        ...(dto.pixReceiptId !== undefined && { pixReceiptId: dto.pixReceiptId }),
        ...(dto.serviceName !== undefined && { serviceName: dto.serviceName }),
        ...(dto.serviceDescription !== undefined && { serviceDescription: dto.serviceDescription }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.paidAt !== undefined && { paidAt: dto.paidAt ? new Date(dto.paidAt) : null }),
        ...(dto.payStub !== undefined && { payStub: dto.payStub }),
      },
    });

    return this.toResponse(updated);
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

    const now = new Date();

    await this.prisma.installment.update({
      where: { id: installmentId },
      data: { paidAt: now },
    });

    const allPaid = record.installments.every((i) => i.id === installmentId || i.paidAt !== null);
    if (allPaid) {
      await this.prisma.accountReceivable.update({
        where: { id: accountReceivableId },
        data: { paidAt: now, status: 'PAID' },
      });
    }

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

  async remove(userId: string, id: string) {
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    await this.prisma.accountReceivable.delete({ where: { id } });
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
      pixReceiptId: string | null;
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

    if (installments !== undefined) {
      return { ...base, installments: installments.map((i) => this.toInstallmentResponse(i)) };
    }

    return base;
  }
}
