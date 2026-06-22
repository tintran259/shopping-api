import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PaymentMethodCode, PaymentStatus } from '../../../common/enums';
import { Payment } from '../entities/payment.entity';
import { PaymentsRepository } from '../repositories/payments.repository';

@Injectable()
export class PaymentsService {
  constructor(private readonly payments: PaymentsRepository) {}

  /** Create the initial (pending) payment for an order, inside its transaction. */
  createForOrder(
    manager: EntityManager,
    orderId: string,
    methodCode: PaymentMethodCode,
    amount: string,
  ): Promise<Payment> {
    return this.payments.createInTx(manager, {
      orderId,
      methodCode,
      amount,
      status: PaymentStatus.PENDING,
    });
  }

  findByOrder(orderId: string): Promise<Payment[]> {
    return this.payments.findByOrder(orderId);
  }

  async findLatestForOrder(orderId: string): Promise<Payment> {
    const [payment] = await this.findByOrder(orderId);
    if (!payment) throw new NotFoundException('Payment not found for order');
    return payment;
  }

  async markStatus(
    paymentId: string,
    status: PaymentStatus,
    meta?: { transactionRef?: string; payload?: Record<string, unknown> },
  ): Promise<Payment> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    payment.status = status;
    if (meta?.transactionRef) payment.transactionRef = meta.transactionRef;
    if (meta?.payload) payment.payload = meta.payload;
    if (status === PaymentStatus.PAID) payment.paidAt = new Date();
    return this.payments.save(payment);
  }
}
