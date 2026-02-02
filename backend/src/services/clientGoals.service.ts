import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from './googleSheets.service';

const prisma = new PrismaClient();

// Month names in Spanish
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface ClientGoalsMetrics {
  month: string;
  monthNumber: number;
  year: number;
  isArchived: boolean;
  budget: {
    total: number;
    recurring: number;
    projects: number;
  };
  executed: {
    total: number;
    recurring: number;
    projects: number;
  };
  completion: {
    percentage: number;
    remaining: number;
    isAchieved: boolean;
  };
  weekly: {
    currentWeek: number;
    totalWeeks: number;
    recurringTarget: number;
    projectsTarget: number;
    recurringExecuted: number;
    projectsExecuted: number;
    recurringPercentage: number;
    projectsPercentage: number;
  };
}

/**
 * Get the number of weeks in a month
 */
function getWeeksInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  return Math.ceil(daysInMonth / 7);
}

/**
 * Get current week number of the month (1-based)
 */
function getCurrentWeekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

/**
 * Get start and end dates for a month
 */
function getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get budget for a specific month from Google Sheets
 */
async function getBudgetForMonth(monthName: string): Promise<number> {
  try {
    const budgetData = await googleSheetsService.getBudgetData();
    const monthKey = monthName.toLowerCase() as 'enero' | 'febrero' | 'marzo';

    // Only Q1 months are available in the current budget structure
    if (monthKey === 'enero' || monthKey === 'febrero' || monthKey === 'marzo') {
      return budgetData.ingresos.totales[monthKey]?.proyectado || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting budget for month:', error);
    return 0;
  }
}

/**
 * Get executed revenue from won deals in a specific month
 */
async function getWonDealsForMonth(year: number, month: number): Promise<{
  total: number;
  recurring: number;
  projects: number;
}> {
  try {
    const { start, end } = getMonthDateRange(year, month);

    // Find won stage
    const wonStage = await prisma.dealStage.findFirst({
      where: { isWon: true },
    });

    if (!wonStage) {
      return { total: 0, recurring: 0, projects: 0 };
    }

    // Get all won deals in the month
    const wonDeals = await prisma.deal.findMany({
      where: {
        stageId: wonStage.id,
        closedAt: {
          gte: start,
          lte: end,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        estimatedValue: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let total = 0;
    let recurring = 0;
    let projects = 0;

    for (const deal of wonDeals) {
      const value = deal.estimatedValue || 0;
      total += value;

      // Check if deal has a service to categorize
      // For now, we'll split 50/50 if no service info is available
      // Later this could be based on the service type or contract terms
      if (deal.service) {
        // Could add logic here based on service name patterns
        // For now, assume 60% recurring, 40% projects as a reasonable default
        recurring += value * 0.6;
        projects += value * 0.4;
      } else {
        recurring += value * 0.5;
        projects += value * 0.5;
      }
    }

    return { total, recurring, projects };
  } catch (error) {
    console.error('Error getting won deals for month:', error);
    return { total: 0, recurring: 0, projects: 0 };
  }
}

/**
 * Get executed revenue from active client services
 */
async function getClientServicesForMonth(year: number, month: number): Promise<{
  recurring: number;
  projects: number;
}> {
  try {
    const { start, end } = getMonthDateRange(year, month);

    // Get active client services
    const clientServices = await prisma.clientService.findMany({
      where: {
        estado: 'activo',
        fechaInicio: {
          lte: end,
        },
        OR: [
          { fechaVencimiento: null },
          { fechaVencimiento: { gte: start } },
        ],
      },
      select: {
        id: true,
        precioCliente: true,
        frecuencia: true,
        service: {
          select: {
            price: true,
          },
        },
      },
    });

    let recurring = 0;
    let projects = 0;

    for (const cs of clientServices) {
      const price = cs.precioCliente || cs.service?.price || 0;

      if (cs.frecuencia === 'mensual') {
        recurring += price;
      } else if (cs.frecuencia === 'unico') {
        projects += price;
      } else if (cs.frecuencia === 'trimestral') {
        // Divide quarterly price by 3 for monthly equivalent
        recurring += price / 3;
      } else if (cs.frecuencia === 'semestral') {
        recurring += price / 6;
      } else if (cs.frecuencia === 'anual') {
        recurring += price / 12;
      }
    }

    return { recurring, projects };
  } catch (error) {
    console.error('Error getting client services for month:', error);
    return { recurring: 0, projects: 0 };
  }
}

/**
 * Main function to get client goals metrics for a specific month
 */
export async function getClientGoalsMetrics(month: number, year: number): Promise<ClientGoalsMetrics> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Determine if this month is archived (past)
  const isArchived = year < currentYear || (year === currentYear && month < currentMonth);

  const monthName = MONTH_NAMES[month - 1];
  const totalBudget = await getBudgetForMonth(monthName);

  // Get executed values from both sources
  const wonDeals = await getWonDealsForMonth(year, month);
  const clientServices = await getClientServicesForMonth(year, month);

  // Combine executed values (won deals take priority)
  const executed = {
    total: wonDeals.total || (clientServices.recurring + clientServices.projects),
    recurring: wonDeals.recurring || clientServices.recurring,
    projects: wonDeals.projects || clientServices.projects,
  };

  // Calculate completion
  const percentage = totalBudget > 0 ? (executed.total / totalBudget) * 100 : 0;
  const remaining = Math.max(0, totalBudget - executed.total);
  const isAchieved = executed.total >= totalBudget;

  // Calculate weekly metrics
  const totalWeeks = getWeeksInMonth(year, month);
  const currentWeek = isArchived ? totalWeeks : getCurrentWeekOfMonth(now);

  // Weekly targets (same for both since 100% budget applies to all)
  const weeklyTarget = totalBudget / totalWeeks;
  const weeklyTargetPerCategory = weeklyTarget / 2; // Split between recurring and projects

  // Calculate weekly executed based on current week progress
  // For current month, we estimate based on accumulated execution
  const weekFraction = currentWeek / totalWeeks;
  const expectedByNow = totalBudget * weekFraction;

  const recurringExecutedThisWeek = executed.recurring / currentWeek;
  const projectsExecutedThisWeek = executed.projects / currentWeek;

  return {
    month: monthName,
    monthNumber: month,
    year,
    isArchived,
    budget: {
      total: totalBudget,
      recurring: totalBudget / 2, // 50% for recurring
      projects: totalBudget / 2,  // 50% for projects
    },
    executed,
    completion: {
      percentage: Math.min(100, Math.round(percentage * 10) / 10),
      remaining,
      isAchieved,
    },
    weekly: {
      currentWeek,
      totalWeeks,
      recurringTarget: weeklyTargetPerCategory,
      projectsTarget: weeklyTargetPerCategory,
      recurringExecuted: recurringExecutedThisWeek,
      projectsExecuted: projectsExecutedThisWeek,
      recurringPercentage: weeklyTargetPerCategory > 0
        ? Math.min(100, Math.round((recurringExecutedThisWeek / weeklyTargetPerCategory) * 1000) / 10)
        : 0,
      projectsPercentage: weeklyTargetPerCategory > 0
        ? Math.min(100, Math.round((projectsExecutedThisWeek / weeklyTargetPerCategory) * 1000) / 10)
        : 0,
    },
  };
}

/**
 * Get available months for the selector (Q1 2026)
 */
export async function getAvailableMonths(): Promise<Array<{ month: number; year: number; name: string; isArchived: boolean }>> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Currently only Q1 2026 is available in the budget
  const availableMonths = [
    { month: 1, year: 2026, name: 'Enero 2026' },
    { month: 2, year: 2026, name: 'Febrero 2026' },
    { month: 3, year: 2026, name: 'Marzo 2026' },
  ];

  return availableMonths.map(m => ({
    ...m,
    isArchived: m.year < currentYear || (m.year === currentYear && m.month < currentMonth),
  }));
}

export default {
  getClientGoalsMetrics,
  getAvailableMonths,
};
