import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CustomerStatus } from '../../../common/enums';
import { CustomersService } from '../../customers/services/customers.service';
import { Customer } from '../../customers/entities/customer.entity';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly customers: CustomersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const customer = await this.customers.create(dto);
    return this.buildAuthResponse(customer);
  }

  async login(dto: LoginDto) {
    const customer = await this.customers.findByEmailWithSecret(dto.email);
    if (
      !customer ||
      customer.status !== CustomerStatus.ACTIVE ||
      !customer.passwordHash
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.buildAuthResponse(customer);
  }

  private buildAuthResponse(customer: Customer) {
    const accessToken = this.jwt.sign({
      sub: customer.id,
      email: customer.email,
      role: customer.role,
    });
    return {
      accessToken,
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        type: customer.type,
        role: customer.role,
      },
    };
  }
}
