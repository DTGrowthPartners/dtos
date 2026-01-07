export interface CreateClientDto {
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo?: string;
}

export interface UpdateClientDto {
  name?: string;
  email?: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
