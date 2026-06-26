import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateFixedAssetDto {
  name: string;
  category: string;
  acquisitionDate: Date;
  cost: number;
  currency?: string;
  quantity?: number;
  serialNumber?: string;
  location?: string;
  responsible?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateFixedAssetDto {
  name?: string;
  category?: string;
  acquisitionDate?: Date;
  cost?: number;
  currency?: string;
  quantity?: number;
  serialNumber?: string;
  location?: string;
  responsible?: string;
  status?: string;
  disposalDate?: Date;
  notes?: string;
}

export const fixedAssetService = {
  async getAll(filters?: { status?: string; category?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    return prisma.fixedAsset.findMany({
      where,
      orderBy: [{ status: 'asc' }, { acquisitionDate: 'desc' }],
    });
  },

  async getById(id: string) {
    return prisma.fixedAsset.findUnique({ where: { id } });
  },

  async create(data: CreateFixedAssetDto) {
    return prisma.fixedAsset.create({
      data: {
        name: data.name,
        category: data.category,
        acquisitionDate: data.acquisitionDate,
        cost: data.cost,
        currency: data.currency || 'COP',
        quantity: data.quantity ?? 1,
        serialNumber: data.serialNumber || null,
        location: data.location || null,
        responsible: data.responsible || null,
        status: 'activo',
        notes: data.notes || null,
        createdBy: data.createdBy,
      },
    });
  },

  async update(id: string, data: UpdateFixedAssetDto) {
    const asset = await prisma.fixedAsset.findUnique({ where: { id } });
    if (!asset) throw new Error('Activo no encontrado');

    return prisma.fixedAsset.update({ where: { id }, data });
  },

  async remove(id: string) {
    return prisma.fixedAsset.delete({ where: { id } });
  },

  async summary() {
    const assets = await prisma.fixedAsset.findMany();
    const activos = assets.filter((a) => a.status === 'activo');
    const byCategory: Record<string, { count: number; valor: number }> = {};
    for (const a of activos) {
      const k = a.category || 'otros';
      if (!byCategory[k]) byCategory[k] = { count: 0, valor: 0 };
      byCategory[k].count += a.quantity ?? 1;
      byCategory[k].valor += a.cost;
    }
    return {
      valorTotal: activos.reduce((s, a) => s + a.cost, 0),
      totalActivos: activos.reduce((s, a) => s + (a.quantity ?? 1), 0),
      registros: assets.length,
      dadosDeBaja: assets.filter((a) => a.status === 'dado_de_baja').length,
      byCategory,
    };
  },
};
