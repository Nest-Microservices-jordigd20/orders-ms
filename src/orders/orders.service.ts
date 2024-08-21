import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const order = await this.order.create({
        data: createOrderDto
      });

      return order;
    } catch (error) {
      this.handleDBError(error);
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { page, limit, status } = orderPaginationDto;

    const totalRecords = await this.order.count({
      where: {
        status
      }
    });

    const lastPage = Math.ceil(totalRecords / limit);

    return {
      data: await this.order.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          status
        }
      }),
      pagination: {
        page,
        limit,
        totalRecords,
        lastPage
      }
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id
      }
    });

    if (!order) {
      throw new RpcException({
        message: `Order with id #${id} not found`,
        status: HttpStatus.NOT_FOUND
      });
    }

    return order;
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    try {
      const order = await this.order.update({
        where: { id },
        data: { status }
      });

      return order;
    } catch (error) {
      this.handleDBError(error);
    }
  }

  handleDBError(error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new RpcException({
          message: 'Invalid data provided',
          status: HttpStatus.BAD_REQUEST
        });
      }
    }

    this.logger.error(error);
    throw new RpcException({
      message: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR
    });
  }
}
