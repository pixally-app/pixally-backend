import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const USER_SELECT = {
  id: true,
  username: true,
  companyName: true,
  email: true,
  document: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    return user;
  }

  async create(dto: CreateUserDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email já cadastrado');

    const existingDocument = await this.prisma.user.findUnique({ where: { document: dto.document } });
    if (existingDocument) throw new ConflictException('Documento já cadastrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          username: dto.username,
          companyName: dto.companyName,
          email: dto.email,
          document: dto.document,
          phone: dto.phone,
          password: hashedPassword,
          role: Role.user,
          isActive: true,
        },
        select: USER_SELECT,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'document') throw new ConflictException('Documento já cadastrado');
        throw new ConflictException('Email já cadastrado');
      }
      throw error;
    }
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: userId } },
      });
      if (existing) throw new ConflictException('Email já está em uso');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        email: dto.email,
        companyName: dto.companyName,
      },
      select: USER_SELECT,
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
