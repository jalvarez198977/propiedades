import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';

@Injectable()
export class PropertyNoteService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByPropertyId(propertyId: string) {
    return this.prisma.propertyNote.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(propertyId: string, data: { content: string }) {
    return this.prisma.propertyNote.create({
      data: { propertyId, content: data.content },
    });
  }

  async update(id: string, data: { content?: string }) {
    return this.prisma.propertyNote.update({
      where: { id },
      data: { content: data.content },
    });
  }

  async delete(id: string) {
    await this.prisma.propertyNote.delete({ where: { id } });
  }
}
