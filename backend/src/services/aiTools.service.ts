/**
 * AI Tools Service
 *
 * Executes tool functions called by Kimi AI.
 * Each tool accesses real system data (Firestore, PostgreSQL, Google Sheets)
 * and returns formatted results.
 */

import { admin } from '../app';
import fetch from 'node-fetch';

export class AIToolsService {
  private db = admin.firestore();
  private BOT_API_KEY = process.env.BOT_API_KEY || 'dt-bot-secret-key-2024';

  /**
   * Main dispatcher - routes tool calls to specific implementations
   */
  async executeTool(toolName: string, args: any, userId: string): Promise<any> {
    console.log(`[AITools] Executing ${toolName} with args:`, args, `for user:`, userId);

    try {
      switch (toolName) {
        case 'getTasks':
          return await this.getTasks(args, userId);
        case 'getClients':
          return await this.getClients(args, userId);
        case 'getFinances':
          return await this.getFinances(args, userId);
        case 'createTask':
          return await this.createTask(args, userId);
        case 'getDeals':
          return await this.getDeals(args, userId);
        default:
          throw new Error(`Herramienta desconocida: ${toolName}`);
      }
    } catch (error: any) {
      console.error(`[AITools] Error in ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks from Firestore
   */
  private async getTasks(args: any, userId: string) {
    const tasksRef = this.db.collection('tasks');
    let query: any = tasksRef;

    // Filter by status if provided
    if (args.status) {
      query = query.where('status', '==', args.status);
    }

    const snapshot = await query.get();
    let tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply additional in-memory filters
    if (args.priority) {
      tasks = tasks.filter((t: any) => t.priority === args.priority);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      tasks = tasks.filter((t: any) =>
        t.title?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Limit to 20 tasks for performance
    const limitedTasks = tasks.slice(0, 20);

    return {
      success: true,
      count: tasks.length,
      showing: limitedTasks.length,
      tasks: limitedTasks.map((t: any) => ({
        id: t.id,
        title: t.title || 'Sin título',
        description: t.description || '',
        status: t.status || 'TODO',
        priority: t.priority || 'MEDIUM',
        assignee: t.assignee || t.asignado || 'No asignado',
        project: t.project || t.proyecto || '',
        dueDate: t.dueDate || t.fechaLimite || null,
        createdAt: t.createdAt || t.creadoEn || null
      }))
    };
  }

  /**
   * Get clients from PostgreSQL via bot endpoint
   */
  private async getClients(args: any, userId: string) {
    const url = new URL('http://localhost:3001/api/webhook/bot/clients');

    if (args.search) url.searchParams.append('search', args.search);
    if (args.status) url.searchParams.append('status', args.status);

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': this.BOT_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Error consultando clientes: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data;
  }

  /**
   * Get financial data from Google Sheets via bot endpoint
   */
  private async getFinances(args: any, userId: string) {
    const url = new URL('http://localhost:3001/api/webhook/bot/finances');

    if (args.month) {
      url.searchParams.append('mes', args.month);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': this.BOT_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Error consultando finanzas: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data;
  }

  /**
   * Create a new task in Firestore via bot endpoint
   */
  private async createTask(args: any, userId: string) {
    const response = await fetch('http://localhost:3001/api/webhook/bot/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.BOT_API_KEY
      },
      body: JSON.stringify({
        title: args.title,
        description: args.description || '',
        assignee: args.assignee,
        creator: userId,
        priority: args.priority || 'MEDIUM',
        projectId: args.projectId || null,
      })
    });

    if (!response.ok) {
      throw new Error(`Error creando tarea: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data;
  }

  /**
   * Get CRM deals from PostgreSQL via bot endpoint
   */
  private async getDeals(args: any, userId: string) {
    const url = new URL('http://localhost:3001/api/webhook/bot/crm/deals');

    if (args.stage) url.searchParams.append('etapa', args.stage);
    if (args.search) url.searchParams.append('buscar', args.search);

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': this.BOT_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Error consultando deals: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data;
  }
}
