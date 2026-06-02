import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientWhereInput } from '../../generated/prisma/models/Client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validatePhones } from '../utils/phone-validation.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

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
          phoneClients: {
            select: {
              id: true,
              dialCode: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const data = clients.map((client) => {
      const { _count, accountsReceivable, phoneClients, deletedAt, amount, ...rest } = client;

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
        phones: phoneClients,
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
        phoneClients: {
          select: {
            id: true,
            dialCode: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const { _count, accountsReceivable, phoneClients, deletedAt, amount, ...rest } = client;

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
      phones: phoneClients,
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
      validatePhones(dto.phones);

      for (const phone of dto.phones) {
        const existingPhone = await this.prisma.phoneClient.findFirst({
          where: { dialCode: phone.dialCode, phoneNumber: phone.phoneNumber },
        });

        if (existingPhone) {
          throw new ConflictException(`Phone ${phone.dialCode} ${phone.phoneNumber} already in use`);
        }
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

  async update(userId: string, clientId: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (dto.document && dto.document !== client.document) {
      const existingClient = await this.prisma.client.findFirst({
        where: { userId, document: dto.document, deletedAt: null, id: { not: clientId } },
      });

      if (existingClient) {
        throw new ConflictException(`Document ${dto.document} already registered for this user`);
      }
    }

    if (dto.phones?.length) {
      const phonesToValidate = dto.phones
        .filter((p): p is { dialCode: string; phoneNumber: string } => !!p.dialCode && !!p.phoneNumber);
      if (phonesToValidate.length) {
        validatePhones(phonesToValidate);
      }

      for (const phone of dto.phones) {
        if (phone.phoneNumber) {
          const dialCode = phone.dialCode ?? (phone.id
            ? (await this.prisma.phoneClient.findUnique({ where: { id: phone.id } }))?.dialCode
            : undefined);

          const existingPhone = await this.prisma.phoneClient.findFirst({
            where: {
              dialCode: dialCode,
              phoneNumber: phone.phoneNumber,
              ...(phone.id && { id: { not: phone.id } }),
            },
          });

          if (existingPhone) {
            throw new ConflictException(`Phone ${dialCode} ${phone.phoneNumber} already in use`);
          }
        }
      }

      for (const phone of dto.phones) {
        if (phone.id) {
          const existingPhoneRecord = await this.prisma.phoneClient.findFirst({
            where: { id: phone.id, clientId },
          });

          if (!existingPhoneRecord) {
            throw new NotFoundException(`Phone with id ${phone.id} not found for this client`);
          }

          await this.prisma.phoneClient.update({
            where: { id: phone.id },
            data: {
              ...(phone.dialCode && { dialCode: phone.dialCode }),
              ...(phone.phoneNumber && { phoneNumber: phone.phoneNumber }),
            },
          });
        } else {
          await this.prisma.phoneClient.create({
            data: {
              clientId,
              dialCode: phone.dialCode!,
              phoneNumber: phone.phoneNumber!,
            },
          });
        }
      }
    }

    const { phones, ...clientData } = dto;

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(clientData.name && { name: clientData.name }),
        ...(clientData.document && { document: clientData.document }),
        ...(clientData.documentType !== undefined && { documentType: clientData.documentType }),
        ...(clientData.status !== undefined && { status: clientData.status }),
      },
      include: {
        phoneClients: true,
      },
    });

    const { deletedAt, amount, phoneClients, ...rest } = updated;

    return {
      ...rest,
      documentType: rest.documentType ?? '',
      status: rest.status ?? false,
      phones: phoneClients,
    };
  }

  async remove(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });
  }
}
