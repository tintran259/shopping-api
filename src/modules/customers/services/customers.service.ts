import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/paginated-result';
import {
  CustomerRole,
  CustomerStatus,
  CustomerType,
} from '../../../common/enums';
import { NotificationsService } from '../../notifications/services/notifications.service';
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
    private readonly notifications: NotificationsService,
  ) {}

  async create(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    type?: CustomerType;
    role?: CustomerRole;
    /** RBAC: gán StaffRole ngay khi tạo (dùng cho tài khoản admin). */
    staffRoleId?: string;
  }): Promise<Customer> {
    const email = data.email.toLowerCase().trim();
    if (await this.customers.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    const customer = await this.customers.save(
      this.customers.create({
        email,
        passwordHash: await bcrypt.hash(data.password, 10),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        type: data.type ?? CustomerType.INDIVIDUAL,
        role: data.role ?? CustomerRole.CUSTOMER,
        staffRoleId: data.staffRoleId,
      }),
    );

    // Link any pending guest back-in-stock subscriptions that used this email.
    // Fire-and-forget: a failure here must never break registration.
    this.notifications.claimByEmail(email, customer.id).catch(() => undefined);

    return customer;
  }

  findByEmailWithSecret(email: string): Promise<Customer | null> {
    return this.customers.findByEmailWithSecret(email.toLowerCase().trim());
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** RBAC: customer kèm StaffRole (quyền + chi nhánh). Null nếu không tồn tại. */
  findByIdWithStaffRole(id: string): Promise<Customer | null> {
    return this.customers.findByIdWithStaffRole(id);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Customer> {
    const customer = await this.findById(id);
    Object.assign(customer, dto);
    return this.customers.save(customer);
  }

  /** [admin] Sửa hồ sơ khách (tên/điện thoại) rồi trả bản chi tiết đầy đủ
   *  (kèm địa chỉ + hồ sơ B2B) để FE cập nhật cache detail nhất quán. */
  async updateProfileAdmin(id: string, dto: UpdateProfileDto): Promise<Customer> {
    const customer = await this.findById(id);
    Object.assign(customer, dto);
    await this.customers.save(customer);
    return this.findByIdAdmin(id);
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
      throw new ConflictException('Email đã được đăng ký cho tài khoản khác.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // The findByEmail check above is a friendly fast-path, not the real guard —
    // two concurrent requests for the same email can both pass it and race to
    // insert (this happened in testing: one 201, one raw 500 from the DB's own
    // unique index). Catch that here so a race still surfaces as a clean 409.
    let savedId: string;
    try {
      savedId = await this.dataSource.transaction(async (manager) => {
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
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'Email đã được đăng ký cho tài khoản khác.',
        );
      }
      throw error;
    }

    const saved = await this.findByIdAdmin(savedId);

    // Link any pending guest back-in-stock subscriptions that used this email.
    this.notifications.claimByEmail(email, savedId).catch(() => undefined);

    return saved;
  }
}
