export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | Date;
  position?: number;
  color?: string;
  images?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | Date;
  position?: number;
  color?: string;
  images?: string[];
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: Date;
  position: number;
  color?: string;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
}
