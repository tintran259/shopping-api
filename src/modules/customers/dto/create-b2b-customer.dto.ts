import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Admin-created B2B account — unlike self-registration (`/auth/register`),
 *  this also creates the company profile in the same request/transaction. */
export class CreateB2bCustomerDto {
  @ApiProperty({ example: 'purchasing@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, description: 'Initial password for the account' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Công ty TNHH ABC' })
  @IsString()
  companyName: string;

  @ApiProperty({ example: '0301234567' })
  @IsString()
  taxCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ default: '0.00' })
  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @ApiPropertyOptional({ description: 'e.g. NET30' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;
}
