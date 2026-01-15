import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateTerceroDto {
  nombre: string;
  email?: string;
  telefono?: string;
  telefonoCodigo?: string;
  direccion?: string;
  documento?: string;
  esProspecto?: boolean;
  esCliente?: boolean;
  esProveedor?: boolean;
  esEmpleado?: boolean;
  organizacionId?: string;
  clientId?: string; // Referencia a Client (empresa de vista Clientes)
  categoriaProveedor?: string;
  cuentaBancaria?: string;
  cargo?: string;
  salarioBase?: number;
  fechaIngreso?: Date;
  notas?: string;
  tags?: string[];
}

export interface CreateOrganizacionDto {
  nombre: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logo?: string;
  notas?: string;
}

export class TercerosService {
  // ==================== TERCEROS ====================

  async findAllTerceros(filters?: {
    esProspecto?: boolean;
    esCliente?: boolean;
    esProveedor?: boolean;
    esEmpleado?: boolean;
    estado?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.esProspecto !== undefined) where.esProspecto = filters.esProspecto;
    if (filters?.esCliente !== undefined) where.esCliente = filters.esCliente;
    if (filters?.esProveedor !== undefined) where.esProveedor = filters.esProveedor;
    if (filters?.esEmpleado !== undefined) where.esEmpleado = filters.esEmpleado;
    if (filters?.estado) where.estado = filters.estado;

    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { telefono: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.tercero.findMany({
      where,
      include: {
        organizacion: true,
        client: true,
        deals: {
          select: {
            id: true,
            stageId: true,
            estimatedValue: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findTerceroById(id: string) {
    return prisma.tercero.findUnique({
      where: { id },
      include: {
        organizacion: true,
        client: true,
        deals: {
          include: {
            stage: true,
          },
        },
      },
    });
  }

  async createTercero(data: CreateTerceroDto) {
    return prisma.tercero.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        telefonoCodigo: data.telefonoCodigo || '+57',
        direccion: data.direccion,
        documento: data.documento,
        esProspecto: data.esProspecto || false,
        esCliente: data.esCliente || false,
        esProveedor: data.esProveedor || false,
        esEmpleado: data.esEmpleado || false,
        organizacionId: data.organizacionId,
        clientId: data.clientId,
        categoriaProveedor: data.categoriaProveedor,
        cuentaBancaria: data.cuentaBancaria,
        cargo: data.cargo,
        salarioBase: data.salarioBase,
        fechaIngreso: data.fechaIngreso,
        notas: data.notas,
        tags: data.tags || [],
      },
      include: {
        organizacion: true,
        client: true,
      },
    });
  }

  async updateTercero(id: string, data: Partial<CreateTerceroDto>) {
    return prisma.tercero.update({
      where: { id },
      data,
      include: {
        organizacion: true,
        client: true,
      },
    });
  }

  async deleteTercero(id: string) {
    // Soft delete - solo cambiar estado
    return prisma.tercero.update({
      where: { id },
      data: { estado: 'inactivo' },
    });
  }

  async hardDeleteTercero(id: string) {
    return prisma.tercero.delete({
      where: { id },
    });
  }

  // Convertir prospecto a cliente
  async convertirACliente(id: string) {
    return prisma.tercero.update({
      where: { id },
      data: {
        esCliente: true,
        esProspecto: false, // Ya no es solo prospecto
      },
    });
  }

  // ==================== ORGANIZACIONES ====================

  async findAllOrganizaciones(filters?: { estado?: string; search?: string }) {
    const where: any = {};

    if (filters?.estado) where.estado = filters.estado;

    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { nit: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.organizacion.findMany({
      where,
      include: {
        terceros: {
          select: {
            id: true,
            nombre: true,
            esCliente: true,
            esProspecto: true,
          },
        },
        _count: {
          select: { terceros: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOrganizacionById(id: string) {
    return prisma.organizacion.findUnique({
      where: { id },
      include: {
        terceros: true,
      },
    });
  }

  async createOrganizacion(data: CreateOrganizacionDto) {
    return prisma.organizacion.create({
      data: {
        nombre: data.nombre,
        nit: data.nit,
        direccion: data.direccion,
        telefono: data.telefono,
        email: data.email,
        logo: data.logo,
        notas: data.notas,
      },
    });
  }

  async updateOrganizacion(id: string, data: Partial<CreateOrganizacionDto>) {
    return prisma.organizacion.update({
      where: { id },
      data,
    });
  }

  async deleteOrganizacion(id: string) {
    return prisma.organizacion.update({
      where: { id },
      data: { estado: 'inactivo' },
    });
  }

  // ==================== CLIENTES (para asociar terceros) ====================

  async findAllClients() {
    return prisma.client.findMany({
      where: { status: 'active' },
      include: {
        terceros: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            telefonoCodigo: true,
            esCliente: true,
            esProspecto: true,
            esProveedor: true,
            esEmpleado: true,
            cargo: true,
          },
        },
        _count: {
          select: { terceros: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ==================== ESTADÍSTICAS ====================

  async getEstadisticas() {
    const [totalTerceros, prospectos, clientes, proveedores, empleados, organizaciones] =
      await Promise.all([
        prisma.tercero.count({ where: { estado: 'activo' } }),
        prisma.tercero.count({ where: { esProspecto: true, estado: 'activo' } }),
        prisma.tercero.count({ where: { esCliente: true, estado: 'activo' } }),
        prisma.tercero.count({ where: { esProveedor: true, estado: 'activo' } }),
        prisma.tercero.count({ where: { esEmpleado: true, estado: 'activo' } }),
        prisma.organizacion.count({ where: { estado: 'activo' } }),
      ]);

    return {
      totalTerceros,
      prospectos,
      clientes,
      proveedores,
      empleados,
      organizaciones,
    };
  }
}

export const tercerosService = new TercerosService();
