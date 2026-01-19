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
}
