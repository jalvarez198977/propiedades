import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { PropertyNoteService } from './property-note.service';
import { CreatePropertyNoteDto, UpdatePropertyNoteDto } from '@propiedades/types';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertyNoteController {
  constructor(private readonly propertyNoteService: PropertyNoteService) {}

  @Get(':propertyId/notes')
  async getNotes(@Param('propertyId') propertyId: string) {
    return this.propertyNoteService.findAllByPropertyId(propertyId);
  }

  @Post(':propertyId/notes')
  async createNote(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePropertyNoteDto,
  ) {
    return this.propertyNoteService.create(propertyId, dto);
  }

  @Patch(':propertyId/notes/:noteId')
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdatePropertyNoteDto,
  ) {
    return this.propertyNoteService.update(noteId, dto);
  }

  @Delete(':propertyId/notes/:noteId')
  async deleteNote(@Param('noteId') noteId: string) {
    await this.propertyNoteService.delete(noteId);
    return { success: true };
  }
}
