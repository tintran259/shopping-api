import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../entities/shipment.entity';

@Injectable()
export class ShipmentsRepository {
  constructor(
    @InjectRepository(Shipment)
    private readonly repo: Repository<Shipment>,
  ) {}

  findByOrder(orderId: string): Promise<Shipment | null> {
    return this.repo.findOne({ where: { orderId } });
  }

  findByTrackingNo(trackingNo: string): Promise<Shipment | null> {
    return this.repo.findOne({ where: { trackingNo } });
  }

  create(data: Partial<Shipment>): Shipment {
    return this.repo.create(data);
  }

  save(shipment: Shipment): Promise<Shipment> {
    return this.repo.save(shipment);
  }
}
