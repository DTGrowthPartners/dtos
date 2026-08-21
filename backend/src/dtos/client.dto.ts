export interface CreateClientDto {
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo?: string;
  tipoFacturacion?: string; // cuenta_cobro | factura_electronica
}

export interface UpdateClientDto {
  name?: string;
  email?: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
  tipoFacturacion?: string; // cuenta_cobro | factura_electronica
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
  tipoFacturacion: string;
  createdAt: Date;
  updatedAt: Date;
}
