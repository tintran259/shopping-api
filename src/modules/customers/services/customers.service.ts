import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CustomerRole, CustomerType } from '../../../common/enums';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { Customer } from '../entities/customer.entity';
import { CustomersRepository } from '../repositories/customers.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

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
}
