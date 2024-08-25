import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';
import { PaidOrderDto } from './dto/paid-order.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const ids = createOrderDto.items.map((item) => item.productId);
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, { ids })
      );

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find((product) => product.id === orderItem.productId).price;
        return price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price: products.find((product) => product.id === orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId).name
        }))
      };
    } catch (error) {
      throw new RpcException(error);
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
      },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    });

    if (!order) {
      throw new RpcException({
        message: `Order with id #${id} not found`,
        status: HttpStatus.NOT_FOUND
      });
    }

    const productIds = order.OrderItem.map((orderItem) => orderItem.productId);

    try {
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, { ids: productIds })
      );

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId).name
        }))
      };
    } catch (error) {
      throw new RpcException(error);
    }
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

  async createPaymentSession(order: OrderWithProducts) {
    try {
      const paymentSession = await firstValueFrom(
        this.client.send('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.OrderItem.map((orderItem) => ({
            name: orderItem.name,
            price: orderItem.price,
            quantity: orderItem.quantity
          }))
        })
      );

      return paymentSession;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log({ paidOrderDto });

    const order = await this.order.update({
      where: {
        id: paidOrderDto.orderId
      },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripeChargeId,
        OrderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl
          }
        }
      }
    });

    this.logger.log({ order });

    return order;
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
