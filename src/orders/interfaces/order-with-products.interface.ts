import { OrderStatus } from "@prisma/client";

export interface OrderWithProducts {
  OrderItem: {
    name: any;
    price: number;
    productId: number;
    quantity: number;
  }[];
  id: string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus;
  paid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
