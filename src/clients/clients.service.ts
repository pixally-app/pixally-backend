import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientWhereInput } from '../../generated/prisma/models/Client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: ListClientsQueryDto) {
    const { page = 1, limit = 10, name, document, status } = query;
    const skip = (page - 1) * limit;

    const where: ClientWhereInput = {
      userId,
      deletedAt: null,
    };

    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    if (document) {
      where.document = document;
    }

    if (status !== undefined) {
      where.status = status;
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { pixReceipts: true },
          },
          accountsReceivable: {
            select: {
              installmentAmount: true,
              paidAt: true,
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const data = clients.map((client) => {
      const { _count, accountsReceivable, deletedAt, amount, ...rest } = client;

      let totalReceived = 0;
      let totalReceivable = 0;

      for (const ar of accountsReceivable) {
        const value = Number(ar.installmentAmount);
        if (ar.paidAt) {
          totalReceived += value;
        } else {
          totalReceivable += value;
        }
      }

      return {
        ...rest,
        documentType: rest.documentType ?? '',
        status: rest.status ?? false,
        phones: rest.phones ?? '',
        receiptsCount: _count.pixReceipts,
        totalReceived,
        totalReceivable,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
      include: {
        _count: {
          select: { pixReceipts: true },
        },
        accountsReceivable: {
          select: {
            installmentAmount: true,
            paidAt: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const { _count, accountsReceivable, deletedAt, amount, ...rest } = client;

    let totalReceived = 0;
    let totalReceivable = 0;

    for (const ar of accountsReceivable) {
      const value = Number(ar.installmentAmount);
      if (ar.paidAt) {
        totalReceived += value;
      } else {
        totalReceivable += value;
      }
    }

    return {
      ...rest,
      documentType: rest.documentType ?? '',
      status: rest.status ?? false,
      phones: rest.phones ?? '',
      receiptsCount: _count.pixReceipts,
      totalReceived,
      totalReceivable,
    };
  }

  async create(userId: string, dto: CreateClientDto) {
    const existingClient = await this.prisma.client.findFirst({
      where: { userId, document: dto.document, deletedAt: null },
    });

    if (existingClient) {
      throw new ConflictException(`Document ${dto.document} already registered for this user`);
    }

    if (dto.phones?.length) {
      const phoneNumbers = dto.phones.map((p) => p.phoneNumber);
      const existingPhone = await this.prisma.phoneClient.findFirst({
        where: { phoneNumber: { in: phoneNumbers } },
      });

      if (existingPhone) {
        throw new ConflictException(`Phone number ${existingPhone.phoneNumber} already in use`);
      }
    }

    const client = await this.prisma.client.create({
      data: {
        userId,
        name: dto.name,
        document: dto.document,
        documentType: dto.documentType,
        status: dto.status ?? true,
        phoneClients: dto.phones?.length
          ? {
              create: dto.phones.map((p) => ({
                dialCode: p.dialCode,
                phoneNumber: p.phoneNumber,
              })),
            }
          : undefined,
      },
      include: {
        phoneClients: true,
      },
    });

    const { deletedAt, amount, phoneClients, ...rest } = client;

    return {
      ...rest,
      documentType: rest.documentType ?? '',
      status: rest.status ?? false,
      phones: phoneClients,
    };
  }
}
