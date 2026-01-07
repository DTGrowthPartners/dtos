export interface CreateServiceDto {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  duration?: string;
  icon?: string;
}

export interface UpdateServiceDto {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  duration?: string;
  icon?: string;
  status?: string;
}

export interface ServiceResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  duration?: string;
  icon: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
