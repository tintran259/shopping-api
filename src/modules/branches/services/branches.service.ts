import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto, UpdateBranchDto } from '../dto/branch.dto';
import { Branch } from '../entities/branch.entity';
import { BranchesRepository } from '../repositories/branches.repository';

@Injectable()
export class BranchesService {
  constructor(private readonly branches: BranchesRepository) {}

  findAll(): Promise<Branch[]> {
    return this.branches.findAllActive();
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branches.findById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    if (dto.isDefault) await this.branches.clearDefault();
    return this.branches.save(this.branches.create(dto));
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    if (dto.isDefault) await this.branches.clearDefault();
    Object.assign(branch, dto);
    return this.branches.save(branch);
  }

  async remove(id: string): Promise<void> {
    await this.branches.remove(await this.findOne(id));
  }
}
