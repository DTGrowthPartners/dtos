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
  terceroId?: string;
}

interface FinanceData {
  month: string;
  income: number;
  expenses: number;
}

// Terceros (Third Parties) - Clients, Providers, Employees, Freelancers
export interface Tercero {
  id: string;
  tipo: 'cliente' | 'proveedor' | 'empleado' | 'freelancer';
  nombre: string;
  nit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  categoria?: string; // For providers: expense category
  cuentaBancaria?: string;
  salarioBase?: number; // For employees
  cargo?: string; // For employees
  estado: 'activo' | 'inactivo';
  createdAt: string;
}

// Nómina (Payroll) records
export interface NominaRecord {
  id: string;
  fecha: string;
  terceroId: string;
  terceroNombre?: string;
  concepto: 'salario' | 'prima' | 'bonificacion' | 'vacaciones' | 'liquidacion' | 'otro';
  salarioBase: number;
  deducciones: number;
  bonificaciones: number;
  totalPagado: number;
  notas?: string;
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Full access for read/write
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

      // Leer hoja de Entradas (Ingresos) - Columnas A:G (Fecha, Importe, Descripción, Categoría, Cuenta, Entidad, TerceroId)
      // Usamos UNFORMATTED_VALUE para obtener fechas como números seriales y valores sin formato
      // Nota: Las hojas NO tienen encabezados, empiezan desde A1
      const incomeResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Entradas!A1:G',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      // Leer hoja de Salidas (Gastos) - Columnas A:G (Fecha, Importe, Descripción, Categoría, Cuenta, Entidad, TerceroId)
      const expensesResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Salidas!A1:G',
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
      // Columnas: A=Fecha, B=Importe, C=Descripción, D=Categoría, E=Cuenta, F=Entidad, G=TerceroId
      const ingresos: TransactionRow[] = incomeRows
        .filter((row: any[]) => row[1]) // check importe exists
        .map((row: any[]) => ({
          fecha: this.parseDate(row[0]),
          importe: this.parseAmount(row[1]),
          descripcion: String(row[2] || ''),
          categoria: String(row[3] || ''),
          cuenta: String(row[4] || ''),
          entidad: String(row[5] || ''),
          terceroId: row[6] ? String(row[6]) : undefined,
        }));

      // Parsear gastos
      // Columnas: A=Fecha, B=Importe, C=Descripción, D=Categoría, E=Cuenta, F=Entidad, G=TerceroId
      const gastos: TransactionRow[] = expensesRows
        .filter((row: any[]) => row[1]) // check importe exists
        .map((row: any[]) => ({
          fecha: this.parseDate(row[0]),
          importe: this.parseAmount(row[1]),
          descripcion: String(row[2] || ''),
          categoria: String(row[3] || ''),
          cuenta: String(row[4] || ''),
          entidad: String(row[5] || ''),
          terceroId: row[6] ? String(row[6]) : undefined,
        }));

      // Excluir "AJUSTE SALDO" de los totales (es solo un ajuste contable)
      const totalIncome = ingresos
        .filter(item => item.categoria !== 'AJUSTE SALDO')
        .reduce((sum, item) => sum + item.importe, 0);
      const totalExpenses = gastos
        .filter(item => item.categoria !== 'AJUSTE SALDO')
        .reduce((sum, item) => sum + item.importe, 0);

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
      // Excluir "AJUSTE SALDO" de las categorías (es solo un ajuste contable)
      if (gasto.categoria === 'AJUSTE SALDO') return;
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

  // Convert JavaScript Date to Excel/Google Sheets serial number
  private dateToSerialNumber(date: Date): number {
    // Excel/Google Sheets uses December 30, 1899 as day 0
    // JavaScript Date epoch is January 1, 1970
    const excelEpoch = new Date(1899, 11, 30);
    const msPerDay = 24 * 60 * 60 * 1000;

    // Calculate days since Excel epoch, including fractional part for time
    const days = (date.getTime() - excelEpoch.getTime()) / msPerDay;

    return days;
  }

  async addExpense(expense: {
    fecha: string;
    importe: number;
    descripcion: string;
    categoria: string;
    cuenta: string;
    entidad: string;
    terceroId?: string;
  }): Promise<void> {
    try {
      // Parse YYYY-MM-DD and create date with current time
      const [year, month, day] = expense.fecha.split('-').map(Number);
      const now = new Date();
      const fechaConHora = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());

      // Convert to Excel serial number for proper formatting in Google Sheets
      const serialDate = this.dateToSerialNumber(fechaConHora);

      // First, get the sheet ID for "Salidas"
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const salidasSheet = spreadsheet.data.sheets?.find(
        (sheet: { properties?: { title?: string; sheetId?: number } }) => sheet.properties?.title === 'Salidas'
      );

      if (!salidasSheet) {
        throw new Error('No se encontró la hoja "Salidas"');
      }

      const sheetId = salidasSheet.properties?.sheetId;

      // Insert a new row at position 2 (after header row 1)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: 1, // After row 1 (header)
                  endIndex: 2,   // Insert 1 row
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      // Now update the newly inserted row (row 2) with data
      const values = [[
        serialDate,
        expense.importe,
        expense.descripcion,
        expense.categoria,
        expense.cuenta,
        expense.entidad,
        expense.terceroId || '',
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Salidas!A2:G2',
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      console.log('Expense added successfully at row 2:', expense, 'Serial date:', serialDate);
    } catch (error) {
      console.error('Error adding expense to Google Sheets:', error);
      throw new Error('No se pudo agregar el gasto a Google Sheets');
    }
  }

  async addIncome(income: {
    fecha: string;
    importe: number;
    descripcion: string;
    categoria: string;
    cuenta: string;
    entidad: string;
    terceroId?: string;
  }): Promise<void> {
    try {
      // Parse YYYY-MM-DD and create date with current time
      const [year, month, day] = income.fecha.split('-').map(Number);
      const now = new Date();
      const fechaConHora = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());

      // Convert to Excel serial number for proper formatting in Google Sheets
      const serialDate = this.dateToSerialNumber(fechaConHora);

      // First, get the sheet ID for "Entradas"
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const entradasSheet = spreadsheet.data.sheets?.find(
        (sheet: { properties?: { title?: string; sheetId?: number } }) => sheet.properties?.title === 'Entradas'
      );

      if (!entradasSheet) {
        throw new Error('No se encontró la hoja "Entradas"');
      }

      const sheetId = entradasSheet.properties?.sheetId;

      // Insert a new row at position 2 (after header row 1)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: 1, // After row 1 (header)
                  endIndex: 2,   // Insert 1 row
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      // Now update the newly inserted row (row 2) with data
      const values = [[
        serialDate,
        income.importe,
        income.descripcion,
        income.categoria,
        income.cuenta,
        income.entidad,
        income.terceroId || '',
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Entradas!A2:G2',
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      console.log('Income added successfully at row 2:', income, 'Serial date:', serialDate);
    } catch (error) {
      console.error('Error adding income to Google Sheets:', error);
      throw new Error('No se pudo agregar el ingreso a Google Sheets');
    }
  }

  async getBudgetData(): Promise<{
    ingresos: {
      categorias: Record<string, { proyectado: number; real: number }>;
      totales: { enero: { proyectado: number; real: number }; febrero: { proyectado: number; real: number }; marzo: { proyectado: number; real: number } };
    };
    gastos: {
      categorias: Record<string, { enero: { proyectado: number; real: number }; febrero: { proyectado: number; real: number }; marzo: { proyectado: number; real: number } }>;
      totales: { enero: { proyectado: number; real: number }; febrero: { proyectado: number; real: number }; marzo: { proyectado: number; real: number } };
    };
  }> {
    try {
      // Read from "Presupuesto Q1" sheet - Full data
      // Structure: A=Categoria, B=Enero Proy, C=Enero Real, D=Feb Proy, E=Feb Real, F=Mar Proy, G=Mar Real, H=Total
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Presupuesto Q1'!A1:H70",
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = response.data.values || [];
      console.log('Budget Q1 rows count:', rows.length);

      // Initialize result structure
      const result = {
        ingresos: {
          categorias: {} as Record<string, { proyectado: number; real: number }>,
          totales: {
            enero: { proyectado: 0, real: 0 },
            febrero: { proyectado: 0, real: 0 },
            marzo: { proyectado: 0, real: 0 },
          },
        },
        gastos: {
          categorias: {} as Record<string, { enero: { proyectado: number; real: number }; febrero: { proyectado: number; real: number }; marzo: { proyectado: number; real: number } }>,
          totales: {
            enero: { proyectado: 0, real: 0 },
            febrero: { proyectado: 0, real: 0 },
            marzo: { proyectado: 0, real: 0 },
          },
        },
      };

      let currentSection = ''; // 'ingresos' or 'gastos'

      for (const row of rows) {
        const firstCol = String(row[0] || '').trim().toUpperCase();

        // Detect section changes
        if (firstCol.includes('INGRESOS PROYECTADOS')) {
          currentSection = 'ingresos';
          continue;
        }
        if (firstCol.includes('GASTOS OPERATIVOS')) {
          currentSection = 'gastos';
          continue;
        }

        // Skip headers and section titles
        if (!row[0] || firstCol === 'FUENTE' || firstCol.includes('CLIENTES RECURRENTES') ||
            firstCol.includes('PROYECTOS PUNTUALES') || firstCol.includes('COSTOS FIJOS') ||
            firstCol.includes('COSTOS VARIABLES') || firstCol.includes('RESULTADO')) {
          continue;
        }

        const categoria = String(row[0]).trim();
        const eneroProyectado = typeof row[1] === 'number' ? row[1] : 0;
        const eneroReal = typeof row[2] === 'number' ? row[2] : 0;
        const febreroProyectado = typeof row[3] === 'number' ? row[3] : 0;
        const febreroReal = typeof row[4] === 'number' ? row[4] : 0;
        const marzoProyectado = typeof row[5] === 'number' ? row[5] : 0;
        const marzoReal = typeof row[6] === 'number' ? row[6] : 0;

        // Handle TOTAL INGRESOS
        if (firstCol === 'TOTAL INGRESOS') {
          result.ingresos.totales = {
            enero: { proyectado: eneroProyectado, real: eneroReal },
            febrero: { proyectado: febreroProyectado, real: febreroReal },
            marzo: { proyectado: marzoProyectado, real: marzoReal },
          };
          continue;
        }

        // Handle TOTAL GASTOS
        if (firstCol === 'TOTAL GASTOS') {
          result.gastos.totales = {
            enero: { proyectado: eneroProyectado, real: eneroReal },
            febrero: { proyectado: febreroProyectado, real: febreroReal },
            marzo: { proyectado: marzoProyectado, real: marzoReal },
          };
          continue;
        }

        // Skip subtotals
        if (firstCol.includes('SUBTOTAL')) {
          continue;
        }

        // Add to appropriate section
        if (currentSection === 'gastos' && categoria && (eneroProyectado > 0 || eneroReal > 0 || febreroProyectado > 0 || marzoProyectado > 0)) {
          result.gastos.categorias[categoria] = {
            enero: { proyectado: eneroProyectado, real: eneroReal },
            febrero: { proyectado: febreroProyectado, real: febreroReal },
            marzo: { proyectado: marzoProyectado, real: marzoReal },
          };
        }
      }

      console.log('Budget Q1 data parsed - Gastos categories:', Object.keys(result.gastos.categorias).length);
      console.log('Budget Q1 totales ingresos:', result.ingresos.totales);
      console.log('Budget Q1 totales gastos:', result.gastos.totales);

      return result;
    } catch (error) {
      console.error('Error fetching budget data from Google Sheets:', error);
      // Return empty budget data on error
      return {
        ingresos: {
          categorias: {},
          totales: {
            enero: { proyectado: 0, real: 0 },
            febrero: { proyectado: 0, real: 0 },
            marzo: { proyectado: 0, real: 0 },
          },
        },
        gastos: {
          categorias: {},
          totales: {
            enero: { proyectado: 0, real: 0 },
            febrero: { proyectado: 0, real: 0 },
            marzo: { proyectado: 0, real: 0 },
          },
        },
      };
    }
  }

  // ==================== TERCEROS (Third Parties) ====================

  async getTerceros(): Promise<Tercero[]> {
    try {
      // Columnas: A=ID, B=Tipo, C=Nombre, D=NIT, E=Email, F=Teléfono, G=Dirección, H=Categoría, I=CuentaBancaria, J=SalarioBase, K=Cargo, L=Estado, M=CreatedAt
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Terceros!A2:M',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = response.data.values || [];

      return rows
        .filter((row: any[]) => row[0]) // Has ID
        .map((row: any[]) => ({
          id: String(row[0]),
          tipo: String(row[1] || 'proveedor') as Tercero['tipo'],
          nombre: String(row[2] || ''),
          nit: row[3] ? String(row[3]) : undefined,
          email: row[4] ? String(row[4]) : undefined,
          telefono: row[5] ? String(row[5]) : undefined,
          direccion: row[6] ? String(row[6]) : undefined,
          categoria: row[7] ? String(row[7]) : undefined,
          cuentaBancaria: row[8] ? String(row[8]) : undefined,
          salarioBase: row[9] ? Number(row[9]) : undefined,
          cargo: row[10] ? String(row[10]) : undefined,
          estado: (row[11] || 'activo') as Tercero['estado'],
          createdAt: this.parseDate(row[12]) || new Date().toISOString().split('T')[0],
        }));
    } catch (error: any) {
      // If sheet doesn't exist, return empty array
      if (error.message?.includes('Unable to parse range')) {
        console.log('Terceros sheet does not exist yet, returning empty array');
        return [];
      }
      console.error('Error fetching Terceros:', error);
      throw new Error('No se pudieron cargar los terceros');
    }
  }

  async addTercero(tercero: Omit<Tercero, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Generate unique ID
      const id = `T${Date.now()}`;
      const createdAt = this.dateToSerialNumber(new Date());

      // Ensure sheet exists
      await this.ensureSheetExists('Terceros', [
        'ID', 'Tipo', 'Nombre', 'NIT', 'Email', 'Teléfono', 'Dirección',
        'Categoría', 'CuentaBancaria', 'SalarioBase', 'Cargo', 'Estado', 'CreatedAt'
      ]);

      // Append new row
      const values = [[
        id,
        tercero.tipo,
        tercero.nombre,
        tercero.nit || '',
        tercero.email || '',
        tercero.telefono || '',
        tercero.direccion || '',
        tercero.categoria || '',
        tercero.cuentaBancaria || '',
        tercero.salarioBase || '',
        tercero.cargo || '',
        tercero.estado,
        createdAt,
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Terceros!A:M',
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      console.log('Tercero added:', id, tercero.nombre);
      return id;
    } catch (error) {
      console.error('Error adding Tercero:', error);
      throw new Error('No se pudo agregar el tercero');
    }
  }

  async updateTercero(id: string, tercero: Partial<Tercero>): Promise<void> {
    try {
      // Find row by ID
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Terceros!A:A',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row: any[]) => String(row[0]) === id);

      if (rowIndex === -1) {
        throw new Error('Tercero no encontrado');
      }

      // Get current row data
      const currentRow = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Terceros!A${rowIndex + 1}:M${rowIndex + 1}`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const current = currentRow.data.values?.[0] || [];

      // Update with new values
      const values = [[
        id,
        tercero.tipo ?? current[1],
        tercero.nombre ?? current[2],
        tercero.nit ?? current[3] ?? '',
        tercero.email ?? current[4] ?? '',
        tercero.telefono ?? current[5] ?? '',
        tercero.direccion ?? current[6] ?? '',
        tercero.categoria ?? current[7] ?? '',
        tercero.cuentaBancaria ?? current[8] ?? '',
        tercero.salarioBase ?? current[9] ?? '',
        tercero.cargo ?? current[10] ?? '',
        tercero.estado ?? current[11],
        current[12], // Keep original createdAt
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Terceros!A${rowIndex + 1}:M${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      console.log('Tercero updated:', id);
    } catch (error) {
      console.error('Error updating Tercero:', error);
      throw new Error('No se pudo actualizar el tercero');
    }
  }

  async deleteTercero(id: string): Promise<void> {
    try {
      // Soft delete - just change status to inactive
      await this.updateTercero(id, { estado: 'inactivo' });
      console.log('Tercero deactivated:', id);
    } catch (error) {
      console.error('Error deleting Tercero:', error);
      throw new Error('No se pudo eliminar el tercero');
    }
  }

  // ==================== NÓMINA (Payroll) ====================

  async getNomina(): Promise<NominaRecord[]> {
    try {
      // Columnas: A=ID, B=Fecha, C=TerceroId, D=TerceroNombre, E=Concepto, F=SalarioBase, G=Deducciones, H=Bonificaciones, I=TotalPagado, J=Notas
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Nomina!A2:J',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = response.data.values || [];

      return rows
        .filter((row: any[]) => row[0]) // Has ID
        .map((row: any[]) => ({
          id: String(row[0]),
          fecha: this.parseDate(row[1]),
          terceroId: String(row[2] || ''),
          terceroNombre: row[3] ? String(row[3]) : undefined,
          concepto: (row[4] || 'salario') as NominaRecord['concepto'],
          salarioBase: Number(row[5]) || 0,
          deducciones: Number(row[6]) || 0,
          bonificaciones: Number(row[7]) || 0,
          totalPagado: Number(row[8]) || 0,
          notas: row[9] ? String(row[9]) : undefined,
        }));
    } catch (error: any) {
      if (error.message?.includes('Unable to parse range')) {
        console.log('Nomina sheet does not exist yet, returning empty array');
        return [];
      }
      console.error('Error fetching Nomina:', error);
      throw new Error('No se pudo cargar la nómina');
    }
  }

  async addNominaRecord(record: Omit<NominaRecord, 'id'>): Promise<string> {
    try {
      const id = `N${Date.now()}`;

      // Parse date
      const [year, month, day] = record.fecha.split('-').map(Number);
      const fechaSerial = this.dateToSerialNumber(new Date(year, month - 1, day));

      // Ensure sheet exists
      await this.ensureSheetExists('Nomina', [
        'ID', 'Fecha', 'TerceroId', 'TerceroNombre', 'Concepto',
        'SalarioBase', 'Deducciones', 'Bonificaciones', 'TotalPagado', 'Notas'
      ]);

      const values = [[
        id,
        fechaSerial,
        record.terceroId,
        record.terceroNombre || '',
        record.concepto,
        record.salarioBase,
        record.deducciones,
        record.bonificaciones,
        record.totalPagado,
        record.notas || '',
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Nomina!A:J',
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      // Also add as expense in Salidas
      await this.addExpense({
        fecha: record.fecha,
        importe: record.totalPagado,
        descripcion: `Nómina: ${record.terceroNombre || record.terceroId} - ${record.concepto}`,
        categoria: 'Nómina',
        cuenta: 'Principal',
        entidad: record.terceroNombre || record.terceroId,
        terceroId: record.terceroId,
      });

      console.log('Nomina record added:', id);
      return id;
    } catch (error) {
      console.error('Error adding Nomina record:', error);
      throw new Error('No se pudo agregar el registro de nómina');
    }
  }

  // Helper to ensure a sheet exists with headers
  private async ensureSheetExists(sheetName: string, headers: string[]): Promise<void> {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const existingSheet = spreadsheet.data.sheets?.find(
        (sheet: { properties?: { title?: string } }) => sheet.properties?.title === sheetName
      );

      if (!existingSheet) {
        // Create new sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: sheetName },
              },
            }],
          },
        });

        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });

        console.log(`Sheet "${sheetName}" created with headers`);
      }
    } catch (error) {
      console.error(`Error ensuring sheet ${sheetName} exists:`, error);
    }
  }

  // Get expense summary by tercero
  async getExpensesByTercero(): Promise<Array<{ terceroId: string; nombre: string; total: number; count: number }>> {
    try {
      const { gastos } = await this.getFinanceData();
      const terceros = await this.getTerceros();

      const terceroMap = new Map(terceros.map(t => [t.nombre.toLowerCase(), t]));
      const summary = new Map<string, { nombre: string; total: number; count: number }>();

      gastos.forEach(gasto => {
        const entidad = gasto.entidad.toLowerCase();
        const tercero = terceroMap.get(entidad);
        const key = tercero?.id || entidad;
        const nombre = tercero?.nombre || gasto.entidad;

        const current = summary.get(key) || { nombre, total: 0, count: 0 };
        current.total += gasto.importe;
        current.count += 1;
        summary.set(key, current);
      });

      return Array.from(summary.entries())
        .map(([terceroId, data]) => ({ terceroId, ...data }))
        .sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error('Error getting expenses by tercero:', error);
      return [];
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
