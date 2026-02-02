import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from './googleSheets.service';

const prisma = new PrismaClient();

// Month names in Spanish
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface WeeklyDetail {
  weekNumber: number;
  target: number;
  executed: number;
  percentage: number;
}

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
  // Detalle semanal por tipo
  weeklyRecurring: {
    monthlyTarget: number;
    weeklyTarget: number;
    weeks: WeeklyDetail[];
  };
  weeklyProjects: {
    monthlyTarget: number;
    weeklyTarget: number;
    weeks: WeeklyDetail[];
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
 * Get start and end dates for a specific week of a month
 */
function getWeekDateRange(year: number, month: number, weekNumber: number): { start: Date; end: Date } {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  const weekStartDay = (weekNumber - 1) * 7 + 1;
  const weekEndDay = Math.min(weekNumber * 7, lastDayOfMonth.getDate());

  const start = new Date(year, month - 1, weekStartDay, 0, 0, 0, 0);
  const end = new Date(year, month - 1, weekEndDay, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Get executed revenue from won deals for a specific week
 */
async function getWonDealsForWeek(year: number, month: number, weekNumber: number): Promise<{
  total: number;
  recurring: number;
  projects: number;
}> {
  try {
    const { start, end } = getWeekDateRange(year, month, weekNumber);

    // Find won stage
    const wonStage = await prisma.dealStage.findFirst({
      where: { isWon: true },
    });

    if (!wonStage) {
      return { total: 0, recurring: 0, projects: 0 };
    }

    // Get all won deals in the week
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

      if (deal.service) {
        recurring += value * 0.6;
        projects += value * 0.4;
      } else {
        recurring += value * 0.5;
        projects += value * 0.5;
      }
    }

    return { total, recurring, projects };
  } catch (error) {
    console.error('Error getting won deals for week:', error);
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

  // Budget split 50/50 between recurring and projects
  const recurringMonthlyBudget = totalBudget / 2;
  const projectsMonthlyBudget = totalBudget / 2;

  // Weekly targets
  const weeklyTarget = totalBudget / totalWeeks;
  const weeklyTargetPerCategory = weeklyTarget / 2; // Split between recurring and projects

  // Build weekly detail arrays
  const weeklyRecurringDetail: WeeklyDetail[] = [];
  const weeklyProjectsDetail: WeeklyDetail[] = [];

  // Get data for each week (only up to current week for non-archived months)
  const weeksToCalculate = isArchived ? totalWeeks : currentWeek;

  for (let w = 1; w <= totalWeeks; w++) {
    if (w <= weeksToCalculate) {
      // Get actual data for this week
      const weekData = await getWonDealsForWeek(year, month, w);

      weeklyRecurringDetail.push({
        weekNumber: w,
        target: weeklyTargetPerCategory,
        executed: weekData.recurring,
        percentage: weeklyTargetPerCategory > 0
          ? Math.round((weekData.recurring / weeklyTargetPerCategory) * 100)
          : 0,
      });

      weeklyProjectsDetail.push({
        weekNumber: w,
        target: weeklyTargetPerCategory,
        executed: weekData.projects,
        percentage: weeklyTargetPerCategory > 0
          ? Math.round((weekData.projects / weeklyTargetPerCategory) * 100)
          : 0,
      });
    } else {
      // Future weeks - no data yet
      weeklyRecurringDetail.push({
        weekNumber: w,
        target: weeklyTargetPerCategory,
        executed: 0,
        percentage: 0,
      });

      weeklyProjectsDetail.push({
        weekNumber: w,
        target: weeklyTargetPerCategory,
        executed: 0,
        percentage: 0,
      });
    }
  }

  // Get current week data for backwards compatibility
  const currentWeekRecurringExecuted = weeklyRecurringDetail[currentWeek - 1]?.executed || 0;
  const currentWeekProjectsExecuted = weeklyProjectsDetail[currentWeek - 1]?.executed || 0;

  return {
    month: monthName,
    monthNumber: month,
    year,
    isArchived,
    budget: {
      total: totalBudget,
      recurring: recurringMonthlyBudget,
      projects: projectsMonthlyBudget,
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
      recurringExecuted: currentWeekRecurringExecuted,
      projectsExecuted: currentWeekProjectsExecuted,
      recurringPercentage: weeklyTargetPerCategory > 0
        ? Math.min(100, Math.round((currentWeekRecurringExecuted / weeklyTargetPerCategory) * 100))
        : 0,
      projectsPercentage: weeklyTargetPerCategory > 0
        ? Math.min(100, Math.round((currentWeekProjectsExecuted / weeklyTargetPerCategory) * 100))
        : 0,
    },
    weeklyRecurring: {
      monthlyTarget: recurringMonthlyBudget,
      weeklyTarget: weeklyTargetPerCategory,
      weeks: weeklyRecurringDetail,
    },
    weeklyProjects: {
      monthlyTarget: projectsMonthlyBudget,
      weeklyTarget: weeklyTargetPerCategory,
      weeks: weeklyProjectsDetail,
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
