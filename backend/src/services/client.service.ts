import { PrismaClient } from '@prisma/client';
import { CreateClientDto, UpdateClientDto } from '../dtos/client.dto';

const prisma = new PrismaClient();

export class ClientService {
  async create(createClientDto: CreateClientDto, userId: string) {
    const { name, email, nit, phone, address, logo } = createClientDto;

    const existingClient = await prisma.client.findUnique({
      where: { email },
    });

    if (existingClient) {
      throw new Error('Client with this email already exists');
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        nit,
        phone,
        address,
        logo: logo || '/img/logo.png',
        createdBy: userId,
      },
    });

    return client;
  }

  async findAll(_userId: string) {
    // Todos los usuarios pueden ver todos los clientes
    const clients = await prisma.client.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return clients;
  }

  async shareClient(clientId: string, userId: string, shareWithEmail: string) {
    // Find the client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        createdBy: userId,
      },
    });

    if (!client) {
      throw new Error('Client not found or you do not have permission to share it');
    }

    // Find the user to share with
    const userToShareWith = await prisma.user.findUnique({
      where: { email: shareWithEmail },
    });

    if (!userToShareWith) {
      throw new Error('User not found');
    }

    if (userToShareWith.id === userId) {
      throw new Error('Cannot share client with yourself');
    }

    // Check if already shared
    const existingShare = await prisma.clientShare.findUnique({
      where: {
        clientId_userId: {
          clientId,
          userId: userToShareWith.id,
        },
      },
    });

    if (existingShare) {
      throw new Error('Client already shared with this user');
    }

    // Create share
    const share = await prisma.clientShare.create({
      data: {
        clientId,
        userId: userToShareWith.id,
      },
    });

    return share;
  }

  async findOne(id: string, _userId: string) {
    // Todos los usuarios pueden ver cualquier cliente
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto, _userId: string) {
    // Cualquier usuario autenticado puede actualizar clientes
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: updateClientDto,
    });

    return updatedClient;
  }

  async remove(id: string, _userId: string) {
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Use transaction to clean up all references before deleting client
    await prisma.$transaction(async (tx) => {
      // Delete client services
      await tx.clientService.deleteMany({
        where: { clientId: id },
      });

      // Delete client shares
      await tx.clientShare.deleteMany({
        where: { clientId: id },
      });

      // Unassign terceros from this client
      await tx.tercero.updateMany({
        where: { clientId: id },
        data: { clientId: null },
      });

      // Delete account payments first, then accounts
      const accounts = await tx.account.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const accountIds = accounts.map(a => a.id);

      if (accountIds.length > 0) {
        await tx.accountPayment.deleteMany({
          where: { accountId: { in: accountIds } },
        });
      }

      await tx.account.deleteMany({
        where: { clientId: id },
      });

      // Finally delete the client
      await tx.client.delete({
        where: { id },
      });
    });

    return { message: 'Client deleted successfully' };
  }

  // ==================== Sedes (sucursales físicas del cliente) ====================
  async getSedes(clientId: string) {
    return prisma.clientSede.findMany({
      where: { clientId },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addSede(
    clientId: string,
    data: { nombre?: string; direccion?: string; ciudad?: string; telefono?: string; esPrincipal?: boolean }
  ) {
    if (!data?.nombre || !data.nombre.trim()) throw new Error('El nombre de la sede es obligatorio');
    return prisma.clientSede.create({
      data: {
        clientId,
        nombre: data.nombre.trim(),
        direccion: data.direccion?.trim() || null,
        ciudad: data.ciudad?.trim() || null,
        telefono: data.telefono?.trim() || null,
        esPrincipal: !!data.esPrincipal,
      },
    });
  }

  async updateSede(
    sedeId: string,
    data: { nombre?: string; direccion?: string; ciudad?: string; telefono?: string; esPrincipal?: boolean }
  ) {
    return prisma.clientSede.update({
      where: { id: sedeId },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
        ...(data.direccion !== undefined ? { direccion: data.direccion?.trim() || null } : {}),
        ...(data.ciudad !== undefined ? { ciudad: data.ciudad?.trim() || null } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono?.trim() || null } : {}),
        ...(data.esPrincipal !== undefined ? { esPrincipal: !!data.esPrincipal } : {}),
      },
    });
  }

  async deleteSede(sedeId: string) {
    await prisma.clientSede.delete({ where: { id: sedeId } });
    return { message: 'Sede eliminada' };
  }

  // ==================== Comisión por inversión en pauta ====================
  /**
   * Calcula la comisión de un cliente para un periodo: % (del servicio marcado como
   * comisión) sobre la inversión en Meta Ads. Si el cliente tiene metaAdAccountId,
   * la inversión se trae de la API de Meta (ApiAppsuite); si no, hay que ingresarla manual.
   */
  async getComision(clientId: string, periodo: 'this_month' | 'last_month' | 'last_14d' | 'last_30d') {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    const comisionSvc = await prisma.clientService.findFirst({
      where: { clientId, esComision: true, estado: 'activo' },
      include: { service: { select: { name: true } } },
    });
    const porcentaje = comisionSvc?.porcentajeComision ?? null;

    let inversion: number | null = null;
    let fuente: 'meta' | 'manual' = 'manual';
    let detalle: { name: string; spend: number }[] = [];
    if (client.metaAdAccountId) {
      try {
        const { metaAdsService } = await import('./metaAds.service');
        const campaigns = await metaAdsService.getCampaigns(client.metaAdAccountId, periodo);
        detalle = campaigns
          .map((c) => ({ name: c.name, spend: parseFloat(c.insights?.spend || '0') || 0 }))
          .filter((c) => c.spend > 0);
        inversion = detalle.reduce((a, c) => a + c.spend, 0);
        fuente = 'meta';
      } catch (e) {
        console.warn('[comision] no se pudo leer Meta:', (e as Error).message);
      }
    }

    return {
      cliente: client.name,
      periodo,
      servicioComision: comisionSvc?.service.name || null,
      porcentaje,
      metaConectado: !!client.metaAdAccountId,
      fuente,
      inversion: inversion != null ? Math.round(inversion) : null,
      comision: inversion != null && porcentaje != null ? Math.round((inversion * porcentaje) / 100) : null,
      campanas: detalle,
    };
  }
}
