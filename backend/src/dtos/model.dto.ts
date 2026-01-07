export interface CreateModelDto {
  name: string;
  description: string;
  type: string;
  parameters: Record<string, any>;
}

export interface UpdateModelDto {
  name?: string;
  description?: string;
  type?: string;
  parameters?: Record<string, any>;
}

export interface ModelResponse {
  id: string;
  name: string;
  description: string;
  type: string;
  parameters: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}