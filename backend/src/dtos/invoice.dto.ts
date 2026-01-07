export interface ServiceItemDto {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export interface CreateInvoiceDto {
  nombre_cliente: string;
  identificacion: string;
  servicios: ServiceItemDto[];
  observaciones: string;
  concepto: string;
  fecha: string;
  servicio_proyecto?: string;
  cliente_id?: string;
}
