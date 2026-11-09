import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../shared/infrastructure/guards/organization.guard';
import { RequireRole } from '../../../shared/infrastructure/decorators/require-role.decorator';
import { GetDashboardMetricsUseCase } from '../application/get-dashboard-metrics.use-case';
import { GetFinancialStatementUseCase } from '../application/get-financial-statement.use-case';
import { OrganizationRole } from '@propiedades/types';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly getDashboardMetricsUseCase: GetDashboardMetricsUseCase,
    private readonly getFinancialStatementUseCase: GetFinancialStatementUseCase,
  ) {}

  @Get('dashboard')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR, OrganizationRole.VIEWER)
  @ApiOperation({ summary: 'Obtener métricas y KPIs para el dashboard' })
  async getDashboard(@Request() req: any) {
    return this.getDashboardMetricsUseCase.execute(req.organizationId);
  }

  @Get('statement')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR, OrganizationRole.VIEWER)
  @ApiOperation({ summary: 'Obtener rendición de caja (ingresos y egresos) por rango de fechas' })
  async getStatement(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const getChileOffsetMinutes = (date: Date): number => {
      try {
        const tzString = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Santiago',
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric',
          hour12: false
        }).format(date);
        
        const match = tzString.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/);
        if (!match) return -240; 
        
        const [_, month, day, year, hour, minute, second] = match;
        const localUtc = Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        );
        
        return (localUtc - date.getTime()) / 60000;
      } catch (err) {
        return -240; // Fallback to GMT-4
      }
    };

    const parseChileDate = (dateStr: string, isEnd = false): Date => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const utcDate = new Date(dateStr + (isEnd ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
        const offsetMin = getChileOffsetMinutes(utcDate);
        return new Date(utcDate.getTime() - offsetMin * 60000);
      }
      return new Date(dateStr);
    };

    let sDate = startDate;
    let eDate = endDate;

    if (!sDate || !eDate) {
      // Default to today in Chile timezone if dates are missing
      const now = new Date();
      const offsetMin = getChileOffsetMinutes(now);
      const chileLocalTime = new Date(now.getTime() + offsetMin * 60000);
      
      const year = chileLocalTime.getUTCFullYear();
      const month = String(chileLocalTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(chileLocalTime.getUTCDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      sDate = sDate || todayStr;
      eDate = eDate || todayStr;
    }

    const startUtc = new Date(sDate + 'T00:00:00.000Z');
    const endUtc = new Date(eDate + 'T23:59:59.999Z');
    const startChile = parseChileDate(sDate, false);
    const endChile = parseChileDate(eDate, true);

    return this.getFinancialStatementUseCase.execute(req.organizationId, {
      startUtc,
      endUtc,
      startChile,
      endChile,
    });
  }
}
