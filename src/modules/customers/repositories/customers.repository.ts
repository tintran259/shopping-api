import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomerRole,
  CustomerStatus,
  CustomerType,
} from '../../../common/enums';
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

  /** Admin detail view — same as {@link findById} plus the address book. */
  findByIdWithDetails(id: string): Promise<Customer | null> {
    return this.repo.findOne({
      where: { id },
      relations: { b2bProfile: true, addresses: true },
    });
  }

  /** RBAC: nạp kèm StaffRole (quyền + phạm vi chi nhánh) để dựng AuthContext. */
  findByIdWithStaffRole(id: string): Promise<Customer | null> {
    return this.repo.findOne({
      where: { id },
      relations: { staffRole: true },
    });
  }

  /** Back-office list — real customers only (never staff/admin accounts),
   *  filter/search/sort/paginate all server-side. */
  async searchAdmin(
    filters: { type?: CustomerType; status?: CustomerStatus; q?: string },
    sort: { by: string; order: 'ASC' | 'DESC' },
    skip: number,
    take: number,
  ): Promise<[Customer[], number]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.b2bProfile', 'b2bProfile')
      .where('c.role = :role', { role: CustomerRole.CUSTOMER });

    if (filters.type) {
      qb.andWhere('c.type = :type', { type: filters.type });
    }
    if (filters.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }
    if (filters.q) {
      qb.andWhere(
        '(c.email ILIKE :q OR c.phone ILIKE :q OR c.firstName ILIKE :q OR c.lastName ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    return qb
      .orderBy(`c.${sort.by}`, sort.order)
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }
}
