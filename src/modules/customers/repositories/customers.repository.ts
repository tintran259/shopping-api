import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';

/** Owns all DB access for customers. Services depend on this, never on TypeORM. */
@Injectable()
export class CustomersRepository {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  create(data: Partial<Customer>): Customer {
    return this.repo.create(data);
  }

  save(customer: Customer): Promise<Customer> {
    return this.repo.save(customer);
  }

  findByEmail(email: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { email } });
  }

  /** Includes the (select:false) password hash — for credential checks only. */
  findByEmailWithSecret(email: string): Promise<Customer | null> {
    return this.repo
      .createQueryBuilder('c')
      .addSelect('c.passwordHash')
      .where('c.email = :email', { email })
      .getOne();
  }

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({
      where: { id },
      relations: { b2bProfile: true },
    });
  }
}
