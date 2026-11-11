import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';

export interface IpcMonthDetail {
  year: number;
  month: number;
  monthName: string;
  value: number;
}

export interface IpcCalculationResult {
  periodLabel: string;
  monthsCount: number;
  monthsDetail: IpcMonthDetail[];
  cumulativePercentage: number;
  multiplier: number;
  currentRent?: number;
  increaseAmount?: number;
  suggestedRent?: number;
  roundedRent?: number;
}

@Injectable()
export class IndicatorService {
  private readonly logger = new Logger(IndicatorService.name);
  private readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(private readonly prisma: PrismaService) {}

  async calculateIpc(
    months = 6,
    currentRent?: number,
    startYear?: number,
    startMonth?: number,
    endYear?: number,
    endMonth?: number,
  ): Promise<IpcCalculationResult> {
    const allIpc = await this.prisma.economicIndicator.findMany({
      where: { code: 'IPC' },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    let selected: typeof allIpc = [];

    if (startYear && startMonth && endYear && endMonth) {
      const startVal = startYear * 12 + startMonth;
      const endVal = endYear * 12 + endMonth;
      selected = allIpc.filter(item => {
        const itemVal = item.year * 12 + item.month;
        return itemVal >= startVal && itemVal <= endVal;
      });
    }

    // Fallback: If no range or range yielded empty, take the last `months` available
    if (selected.length === 0) {
      selected = allIpc.slice(-months);
    }

    let factor = 1.0;
    const monthsDetail: IpcMonthDetail[] = selected.map(item => {
      const val = Number(item.value);
      factor *= (1 + val / 100);
      return {
        year: item.year,
        month: item.month,
        monthName: this.monthNames[item.month - 1],
        value: val,
      };
    });

    const cumulativePercentage = Number(((factor - 1) * 100).toFixed(2));
    const multiplier = Number(factor.toFixed(4));

    let increaseAmount: number | undefined;
    let suggestedRent: number | undefined;
    let roundedRent: number | undefined;

    if (currentRent && currentRent > 0) {
      suggestedRent = Math.round(currentRent * factor);
      increaseAmount = suggestedRent - currentRent;
      roundedRent = Math.round(suggestedRent / 1000) * 1000;
    }

    const first = monthsDetail[0];
    const last = monthsDetail[monthsDetail.length - 1];
    const periodLabel = first && last 
      ? `${first.monthName} ${first.year} – ${last.monthName} ${last.year} (${monthsDetail.length} meses)`
      : `Últimos ${monthsDetail.length} meses`;

    return {
      periodLabel,
      monthsCount: monthsDetail.length,
      monthsDetail,
      cumulativePercentage,
      multiplier,
      currentRent,
      increaseAmount,
      suggestedRent,
      roundedRent,
    };
  }

  async syncIpcFromApi(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    try {
      const res = await fetch('https://mindicador.cl/api/ipc', {
        headers: { 'User-Agent': 'Mozilla/5.0 (PropiedadesApp)' }
      });
      if (!res.ok) {
        return { success: false, syncedCount: 0, message: `API responded with status ${res.status}` };
      }
      const json = await res.json();
      if (!json?.serie || !Array.isArray(json.serie)) {
        return { success: false, syncedCount: 0, message: 'Invalid series format' };
      }

      let count = 0;
      for (const item of json.serie) {
        if (!item.fecha || item.valor === undefined) continue;
        const d = new Date(item.fecha);
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        const value = Number(item.valor);

        await this.prisma.economicIndicator.upsert({
          where: {
            code_year_month: {
              code: 'IPC',
              year,
              month,
            }
          },
          update: { value },
          create: {
            code: 'IPC',
            year,
            month,
            value,
          }
        });
        count++;
      }

      return { success: true, syncedCount: count, message: `Synced ${count} records` };
    } catch (err: any) {
      this.logger.warn(`Could not sync IPC from external API: ${err.message}`);
      return { success: false, syncedCount: 0, message: err.message };
    }
  }
}
