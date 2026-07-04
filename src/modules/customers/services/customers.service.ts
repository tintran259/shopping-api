import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import { CustomerRole, CustomerStatus, CustomerType } from '../../../common/enums';
import { AdminCustomerQueryDto } from '../dto/admin-customer-query.dto';
import { CreateB2bCustomerDto } from '../dto/create-b2b-customer.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { B2bProfile } from '../entities/b2b-profile.entity';
import { Customer } from '../entities/customer.entity';
import { CustomersRepository } from '../repositories/customers.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customers: CustomersRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    type?: CustomerType;
    role?: CustomerRole;
  }): Promise<Customer> {
    const email = data.email.toLowerCase().trim();
    if (await this.customers.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    const customer = this.customers.create({
      email,
      passwordHash: await bcrypt.hash(data.password, 10),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      type: data.type ?? CustomerType.INDIVIDUAL,
      role: data.role ?? CustomerRole.CUSTOMER,
    });
    return this.customers.save(customer);
  }

  findByEmailWithSecret(email: string): Promise<Customer | null> {
    return this.customers.findByEmailWithSecret(email.toLowerCase().trim());
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Customer> {
    const customer = await this.findById(id);
    Object.assign(customer, dto);
    return this.customers.save(customer);
  }

  /** [admin] Paginated customer list — filter/search/sort server-side. */
  async findAllAdmin(
    query: AdminCustomerQueryDto,
  ): Promise<PaginatedResult<Customer>> {
    const [data, total] = await this.customers.searchAdmin(
      { type: query.type, status: query.status, q: query.q },
      { by: query.sortBy ?? 'createdAt', order: query.sortOrder ?? 'DESC' },
      query.skip,
      query.limit,
    );
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** [admin] Detail view — includes the address book (the self-service
   *  {@link findById} doesn't, since /me/addresses is its own endpoint). */
  async findByIdAdmin(id: string): Promise<Customer> {
    const customer = await this.customers.findByIdWithDetails(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** [admin] Suspend/reactivate an account. */
  async updateStatus(id: string, status: CustomerStatus): Promise<Customer> {
    const customer = await this.findById(id);
    customer.status = status;
    return this.customers.save(customer);
  }

  /** [admin] Create a B2B account + its company profile atomically — unlike
   *  self-registration, staff enter the company details up front (a B2B
   *  customer must always have one; a half-created account with no profile
   *  would be a data-integrity gap, so both rows commit together or not at all). */
  async createB2b(dto: CreateB2bCustomerDto): Promise<Customer> {
    const email = dto.email.toLowerCase().trim();
    if (await this.customers.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const customer = manager.create(Customer, {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        type: CustomerType.B2B,
        role: CustomerRole.CUSTOMER,
      });
      const saved = await manager.save(customer);

      const profile = manager.create(B2bProfile, {
        customerId: saved.id,
        companyName: dto.companyName,
        taxCode: dto.taxCode,
        companyAddress: dto.companyAddress,
        creditLimit: dto.creditLimit ?? '0',
        paymentTerms: dto.paymentTerms,
      });
      await manager.save(profile);

      return saved.id;
    });

    return this.findByIdAdmin(savedId);
  }
}
