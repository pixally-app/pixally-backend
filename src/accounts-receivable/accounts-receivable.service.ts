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
      if (status === AccountReceivableStatusFilter.PAGO) {
        where.paidAt = { not: null };
      } else if (status === AccountReceivableStatusFilter.PENDENTE) {
        where.paidAt = null;
        where.dueDate = { gte: now };
      } else if (status === AccountReceivableStatusFilter.VENCIDO) {
        where.paidAt = null;
        where.dueDate = { lt: now };
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
    });

    if (!record) {
      throw new NotFoundException('Account receivable not found');
    }

    return this.toResponse(record);
  }

  async create(userId: string, dto: CreateAccountReceivableDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const record = await this.prisma.accountReceivable.create({
      data: {
        userId,
        clientId: dto.clientId,
        pixReceiptId: dto.pixReceiptId,
        clientName: client.name,
        serviceName: dto.serviceName,
        serviceDescription: dto.serviceDescription,
        totalAmount: dto.totalAmount,
        installmentGroupId: dto.installmentGroupId,
        installmentCount: dto.installmentCount,
        installmentNumber: dto.installmentNumber,
        installmentAmount: dto.installmentAmount ?? dto.totalAmount,
        dueDate: new Date(dto.dueDate),
        payStub: dto.payStub,
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
        ...(dto.installmentCount !== undefined && { installmentCount: dto.installmentCount }),
        ...(dto.installmentNumber !== undefined && { installmentNumber: dto.installmentNumber }),
        ...(dto.installmentAmount !== undefined && { installmentAmount: dto.installmentAmount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.paidAt !== undefined && { paidAt: dto.paidAt ? new Date(dto.paidAt) : null }),
        ...(dto.payStub !== undefined && { payStub: dto.payStub }),
      },
    });

    return this.toResponse(updated);
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

  private toResponse(record: {
    id: string;
    userId: string;
    clientId: string;
    pixReceiptId: string | null;
    clientName: string | null;
    serviceName: string | null;
    serviceDescription: string | null;
    totalAmount: unknown;
    installmentGroupId: string | null;
    installmentCount: number | null;
    installmentNumber: number | null;
    installmentAmount: unknown;
    dueDate: Date;
    status: string | null;
    paidAt: Date | null;
    payStub: string | null;
    matchedAutomatically: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const now = new Date();
    let computedStatus: string;

    if (record.paidAt) {
      computedStatus = 'pago';
    } else if (record.dueDate < now) {
      computedStatus = 'vencido';
    } else {
      computedStatus = 'pendente';
    }

    return {
      ...record,
      totalAmount: Number(record.totalAmount),
      installmentAmount: Number(record.installmentAmount),
      status: computedStatus,
    };
  }
}
