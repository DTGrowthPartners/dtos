import { google } from 'googleapis';
import path from 'path';

const CREDENTIALS_PATH = path.join(__dirname, '../../..', 'credencials.json');
const SPREADSHEET_ID = '1SKHZBmxEsZgKjoEx_p5QtyOy21Z0o9twIsWWlICmuzE';

interface TransactionRow {
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
}

interface FinanceData {
  month: string;
  income: number;
  expenses: number;
}

export class GoogleSheetsService {
  private sheets: any;
  private auth: any;

  constructor() {
    this.initAuth();
  }

  private async initAuth() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async getFinanceData(): Promise<{
    ingresos: TransactionRow[];
    gastos: TransactionRow[];
    financeByMonth: FinanceData[];
    expenseCategories: Array<{ name: string; value: number; color: string }>;
    totalIncome: number;
    totalExpenses: number;
  }> {
    try {

      // Leer hoja de Entradas (Ingresos) - Columnas A:F (Fecha, Importe, Descripción, Categoría, Cuenta, Entidad)
      // Usamos UNFORMATTED_VALUE para obtener fechas como números seriales y valores sin formato
      const incomeResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Entradas!A2:F',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      // Leer hoja de Salidas (Gastos) - Columnas A:F (Fecha, Importe, Descripción, Categoría, Cuenta, Entidad)
      const expensesResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Salidas!A2:F',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const incomeRows = incomeResponse.data.values || [];
      const expensesRows = expensesResponse.data.values || [];

      // Debug: Log raw data from sheets
      console.log('Raw Income Rows (first 5):', incomeRows.slice(0, 5));
      console.log('Raw Expenses Rows (first 5):', expensesRows.slice(0, 5));
      console.log('Total income rows:', incomeRows.length);
      console.log('Total expenses rows:', expensesRows.length);

      // Parsear ingresos
      // Columnas: A=Fecha, B=Importe, C=Descripción, D=Categoría, E=Cuenta, F=Entidad
      const ingresos: TransactionRow[] = incomeRows
        .filter((row: any[]) => row[1]) // check importe exists
        .map((row: any[]) => ({
          fecha: this.parseDate(row[0]),
          importe: this.parseAmount(row[1]),
          descripcion: String(row[2] || ''),
          categoria: String(row[3] || ''),
          cuenta: String(row[4] || ''),
          entidad: String(row[5] || ''),
        }));

      // Parsear gastos
      // Columnas: A=Fecha, B=Importe, C=Descripción, D=Categoría, E=Cuenta, F=Entidad
      const gastos: TransactionRow[] = expensesRows
        .filter((row: any[]) => row[1]) // check importe exists
        .map((row: any[]) => ({
          fecha: this.parseDate(row[0]),
          importe: this.parseAmount(row[1]),
          descripcion: String(row[2] || ''),
          categoria: String(row[3] || ''),
          cuenta: String(row[4] || ''),
          entidad: String(row[5] || ''),
        }));

      const totalIncome = ingresos.reduce((sum, item) => sum + item.importe, 0);
      const totalExpenses = gastos.reduce((sum, item) => sum + item.importe, 0);

      console.log('Google Sheets data extracted:');
      console.log('Ingresos:', ingresos);
      console.log('Gastos:', gastos);
      console.log('Total Income:', totalIncome);
      console.log('Total Expenses:', totalExpenses);

      // Generar datos por mes (últimos 6 meses)
      const financeByMonth = this.generateMonthlyData(totalIncome, totalExpenses);

      // Agrupar gastos por categoría
      const expenseCategories = this.groupExpensesByCategory(gastos);

      return {
        ingresos,
        gastos,
        financeByMonth,
        expenseCategories,
        totalIncome,
        totalExpenses,
      };
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
      throw new Error('No se pudieron cargar los datos de Google Sheets');
    }
  }

  private parseDate(value: string | number | null | undefined): string {
    if (!value) return '';

    // If it's a number, it's a Google Sheets serial date number
    // Google Sheets uses December 30, 1899 as day 0 (Excel compatibility)
    if (typeof value === 'number') {
      // Google Sheets serial date to JavaScript Date
      // Serial number 1 = January 1, 1900
      // But there's a bug in Excel/Sheets where they think 1900 was a leap year
      // So we need to account for that
      const baseDate = new Date(1899, 11, 30); // December 30, 1899
      const resultDate = new Date(baseDate.getTime() + value * 24 * 60 * 60 * 1000);

      const year = resultDate.getFullYear();
      const month = String(resultDate.getMonth() + 1).padStart(2, '0');
      const day = String(resultDate.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    let dateStr = String(value).trim();

    // If it contains time (e.g., "25/09/2025 12:21:00"), remove the time part
    if (dateStr.includes(' ')) {
      dateStr = dateStr.split(' ')[0];
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD for proper sorting and filtering
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateStr;
  }

  private parseAmount(value: any): number {
    // With UNFORMATTED_VALUE, numbers come directly as numbers
    if (typeof value === 'number') return Math.abs(value); // Use abs to handle negative values if any

    // Fallback for string values
    let strValue = String(value).trim();

    // Remove currency symbols, spaces, and any non-numeric characters except . and ,
    strValue = strValue.replace(/[$€COP\s]/gi, '');

    // Check if it's Colombian format: uses dots as thousand separators
    const dots = (strValue.match(/\./g) || []).length;
    const hasComma = strValue.includes(',');

    if (dots > 0) {
      if (hasComma) {
        strValue = strValue.replace(/\./g, '').replace(',', '.');
      } else {
        const isThousandSeparator = /\.\d{3}(?:\.|$)/.test(strValue) || /^\d{1,3}(\.\d{3})+$/.test(strValue);
        if (isThousandSeparator) {
          strValue = strValue.replace(/\./g, '');
        }
      }
    } else if (hasComma) {
      strValue = strValue.replace(',', '.');
    }

    return Math.abs(parseFloat(strValue) || 0);
  }

  private generateMonthlyData(totalIncome: number, totalExpenses: number): FinanceData[] {
    const now = new Date();
    const financeByMonth: FinanceData[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('es-ES', { month: 'short' });

      // Distribuir los ingresos y gastos con variación
      const baseIncome = totalIncome / 6;
      const baseExpenses = totalExpenses / 6;
      const variance = 0.2; // 20% de variación

      financeByMonth.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        income: Math.round(baseIncome + (Math.random() - 0.5) * (baseIncome * variance)),
        expenses: Math.round(baseExpenses + (Math.random() - 0.5) * (baseExpenses * variance)),
      });
    } 

    return financeByMonth;
  }

  private groupExpensesByCategory(gastos: TransactionRow[]): Array<{
    name: string;
    value: number;
    color: string;
  }> {
    const categoryMap = new Map<string, number>();

    gastos.forEach((gasto) => {
      const category = gasto.categoria || 'Otros';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + gasto.importe);
    });

    const colors = [
      'hsl(var(--primary))',
      'hsl(var(--success))',
      'hsl(var(--warning))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ];

    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value: Math.round(value),
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }
}

export const googleSheetsService = new GoogleSheetsService();
