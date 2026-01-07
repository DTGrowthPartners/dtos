import { PrismaClient } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto } from '../dtos/service.dto';

const prisma = new PrismaClient();

export class ServiceService {
  async create(createServiceDto: CreateServiceDto, userId: string) {
    const { name, description, price, currency, duration, icon } = createServiceDto;

    const service = await prisma.service.create({
      data: {
        name,
        description,
        price,
        currency: currency || 'USD',
        duration,
        icon: icon || 'Briefcase',
      },
    });

    return service;
  }

  async findAll(_userId: string) {
    // Todos los usuarios pueden ver todos los servicios
    const services = await prisma.service.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return services;
  }

  async findOne(id: string, _userId: string) {
    // Todos los usuarios pueden ver cualquier servicio
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        clients: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!service) {
      throw new Error('Service not found');
    }

    return service;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, _userId: string) {
    // Todos los usuarios pueden editar servicios (catálogo compartido)
    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new Error('Service not found');
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: updateServiceDto,
    });

    return updatedService;
  }

  async remove(id: string, _userId: string) {
    try {
      // Todos los usuarios pueden eliminar servicios (catálogo compartido)
      const service = await prisma.service.findUnique({
        where: { id },
      });

      if (!service) {
        throw new Error('Service not found');
      }

      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Delete related ClientService records first
        await tx.clientService.deleteMany({
          where: { serviceId: id },
        });

        // Delete the service
        await tx.service.delete({
          where: { id },
        });
      });

      return { message: 'Service deleted successfully' };
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  }
}
