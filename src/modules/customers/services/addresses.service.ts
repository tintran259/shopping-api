import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationsService } from '../../locations/services/locations.service';
import { CreateAddressDto, UpdateAddressDto } from '../dto/address.dto';
import { Address } from '../entities/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';

@Injectable()
export class AddressesService {
  constructor(
    private readonly addresses: AddressesRepository,
    private readonly locations: LocationsService,
  ) {}

  findAll(customerId: string): Promise<Address[]> {
    return this.addresses.findAll(customerId);
  }

  async findOne(customerId: string, id: string): Promise<Address> {
    const address = await this.addresses.findOne(customerId, id);
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(customerId: string, dto: CreateAddressDto): Promise<Address> {
    if (dto.isDefault) await this.addresses.clearDefault(customerId);
    const { province, ward } = await this.locations.resolve(
      dto.provinceCode,
      dto.wardCode,
    );
    return this.addresses.save(
      this.addresses.create({
        customerId,
        label: dto.label,
        recipientName: dto.recipientName,
        phone: dto.phone,
        provinceCode: province.code,
        provinceName: province.name,
        wardCode: ward.code,
        wardName: ward.name,
        street: dto.street,
        isDefault: dto.isDefault,
      }),
    );
  }

  async update(
    customerId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOne(customerId, id);
    if (dto.isDefault) await this.addresses.clearDefault(customerId);

    // Re-resolve names when either code changes.
    const provinceCode = dto.provinceCode ?? address.provinceCode;
    const wardCode = dto.wardCode ?? address.wardCode;
    if (dto.provinceCode != null || dto.wardCode != null) {
      const { province, ward } = await this.locations.resolve(
        provinceCode,
        wardCode,
      );
      address.provinceCode = province.code;
      address.provinceName = province.name;
      address.wardCode = ward.code;
      address.wardName = ward.name;
    }
    if (dto.label !== undefined) address.label = dto.label;
    if (dto.recipientName != null) address.recipientName = dto.recipientName;
    if (dto.phone != null) address.phone = dto.phone;
    if (dto.street != null) address.street = dto.street;
    if (dto.isDefault != null) address.isDefault = dto.isDefault;

    return this.addresses.save(address);
  }

  async remove(customerId: string, id: string): Promise<void> {
    const address = await this.findOne(customerId, id);
    await this.addresses.remove(address);
  }
}
