import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../entities/address.entity';

@Injectable()
export class AddressesRepository {
  constructor(
    @InjectRepository(Address)
    private readonly repo: Repository<Address>,
  ) {}

  create(data: Partial<Address>): Address {
    return this.repo.create(data);
  }

  save(address: Address): Promise<Address> {
    return this.repo.save(address);
  }

  remove(address: Address): Promise<Address> {
    return this.repo.remove(address);
  }

  findAll(customerId: string): Promise<Address[]> {
    return this.repo.find({
      where: { customerId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  findOne(customerId: string, id: string): Promise<Address | null> {
    return this.repo.findOne({ where: { id, customerId } });
  }

  clearDefault(customerId: string): Promise<unknown> {
    return this.repo.update({ customerId }, { isDefault: false });
  }
}
