import { PrismaClient } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto } from '../dtos/task.dto';

const prisma = new PrismaClient();

export class TaskService {
  async create(createTaskDto: CreateTaskDto, userId: string) {
    // Normalize dueDate to proper ISO-8601 DateTime format
    let normalizedDueDate: Date | null = null;
    if (createTaskDto.dueDate) {
      // If it's already a Date object, use it directly
      if (createTaskDto.dueDate instanceof Date) {
        normalizedDueDate = createTaskDto.dueDate;
      } else {
        // If it's a string, ensure it's a complete ISO-8601 format
        // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.sssZ" formats
        const dateString = createTaskDto.dueDate as string;
        // If the string doesn't have time component, add it
        const hasTimeComponent = dateString.includes('T') || dateString.includes(':');
        const fullDateString = hasTimeComponent
          ? dateString
          : `${dateString}T00:00:00.000Z`;
        normalizedDueDate = new Date(fullDateString);
      }
    }

    const task = await prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status || 'pending',
        priority: createTaskDto.priority || 'medium',
        dueDate: normalizedDueDate,
        position: createTaskDto.position ?? 0,
        color: createTaskDto.color ?? '',
        images: createTaskDto.images || [],
        createdBy: userId,
      },
    });

    return task;
  }

  async findAll(userId: string) {
    const tasks = await prisma.task.findMany({
      where: {
        createdBy: userId,
      },
      include: {
        comments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    return tasks;
  }

  async findOne(id: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id,
        createdBy: userId,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id,
        createdBy: userId,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Normalize dueDate to proper ISO-8601 DateTime format
    let normalizedDueDate: Date | null = null;
    if (updateTaskDto.dueDate) {
      // If it's already a Date object, use it directly
      if (updateTaskDto.dueDate instanceof Date) {
        normalizedDueDate = updateTaskDto.dueDate;
      } else {
        // If it's a string, ensure it's a complete ISO-8601 format
        const dateString = updateTaskDto.dueDate as string;
        const hasTimeComponent = dateString.includes('T') || dateString.includes(':');
        const fullDateString = hasTimeComponent
          ? dateString
          : `${dateString}T00:00:00.000Z`;
        normalizedDueDate = new Date(fullDateString);
      }
    }

    const data = {
      ...updateTaskDto,
      dueDate: normalizedDueDate,
    };

    const updatedTask = await prisma.task.update({
      where: { id },
      data,
    });

    return updatedTask;
  }

  async updatePositions(updates: { id: string; position: number }[], userId: string) {
    // Verificar que todas las tareas pertenezcan al usuario
    const taskIds = updates.map(u => u.id);
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        createdBy: userId,
      },
    });

    if (tasks.length !== taskIds.length) {
      throw new Error('One or more tasks not found');
    }

    // Actualizar posiciones
    await Promise.all(
      updates.map(update =>
        prisma.task.update({
          where: { id: update.id },
          data: { position: update.position },
        })
      )
    );

    return { message: 'Positions updated successfully' };
  }

  async remove(id: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id,
        createdBy: userId,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    await prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }

  async addComment(taskId: string, commentData: { text: string; author: string }, userId: string) {
    // Verify task exists and belongs to user
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        createdBy: userId,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Create comment
    const comment = await prisma.taskComment.create({
      data: {
        text: commentData.text,
        author: commentData.author,
        taskId,
      },
    });

    return comment;
  }
}
