import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';

@Injectable()
export class BranchesRepository {
  constructor(
    @InjectRepository(Branch)
    private readonly repo: Repository<Branch>,
  ) {}

  create(data: Partial<Branch>): Branch {
    return this.repo.create(data);
  }

  save(branch: Branch): Promise<Branch> {
    return this.repo.save(branch);
  }

  remove(branch: Branch): Promise<Branch> {
    return this.repo.remove(branch);
  }

  findAllActive(): Promise<Branch[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  findById(id: string): Promise<Branch | null> {
    return this.repo.findOne({ where: { id } });
  }

  clearDefault(): Promise<unknown> {
    return this.repo.update({ isDefault: true }, { isDefault: false });
  }
}
