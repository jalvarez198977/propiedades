import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../shared/infrastructure/guards/organization.guard';
import { IndicatorService } from './indicator.service';

@ApiTags('Indicators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('indicators')
export class IndicatorController {
  constructor(private readonly indicatorService: IndicatorService) {}

  @Get('ipc/calculate')
  @ApiOperation({ summary: 'Calcular reajuste por IPC acumulado para un canon de arriendo' })
  async calculateIpc(
    @Query('months') months?: string,
    @Query('currentRent') currentRent?: string,
    @Query('startYear') startYear?: string,
    @Query('startMonth') startMonth?: string,
    @Query('endYear') endYear?: string,
    @Query('endMonth') endMonth?: string,
  ) {
    return this.indicatorService.calculateIpc(
      months ? parseInt(months, 10) : 6,
      currentRent ? parseFloat(currentRent) : undefined,
      startYear ? parseInt(startYear, 10) : undefined,
      startMonth ? parseInt(startMonth, 10) : undefined,
      endYear ? parseInt(endYear, 10) : undefined,
      endMonth ? parseInt(endMonth, 10) : undefined,
    );
  }

  @Post('ipc/sync')
  @ApiOperation({ summary: 'Sincronizar historial de IPC desde API oficial' })
  async syncIpc() {
    return this.indicatorService.syncIpcFromApi();
  }
}

