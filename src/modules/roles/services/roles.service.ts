import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isAssignablePermission } from '../../../common/permissions';
import { Customer } from '../../customers/entities/customer.entity';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto';
import { StaffRole } from '../entities/staff-role.entity';

/** Mọi thao tác ghi (`.create`/`.update`/`.delete`) luôn kéo theo `.view` — có
 *  thao tác thì đương nhiên phải xem được (khớp UI: bật Thêm/Sửa/Xóa yêu cầu
 *  bật Xem). Đảm bảo route GET (`.view`) không bị chặn. */
function withImpliedViews(permissions: string[]): string[] {
  const set = new Set(permissions);
  for (const p of permissions) {
    const m = p.match(/^(.+)\.(create|update|delete)$/);
    if (m) set.add(`${m[1]}.view`);
  }
  return [...set];
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(StaffRole)
    private readonly roles: Repository<StaffRole>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  findAll(): Promise<StaffRole[]> {
    return this.roles.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<StaffRole> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return role;
  }

  async create(dto: CreateRoleDto): Promise<StaffRole> {
    this.assertValid(dto.permissions, dto.allBranches, dto.branchIds);
    const role = this.roles.create({
      name: dto.name.trim(),
      description: dto.description?.trim(),
      permissions: withImpliedViews(dto.permissions),
      allBranches: dto.allBranches ?? false,
      branchIds: dto.allBranches ? [] : (dto.branchIds ?? []),
    });
    return this.roles.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<StaffRole> {
    const role = await this.findOne(id);
    const permissions = dto.permissions ?? role.permissions;
    const allBranches = dto.allBranches ?? role.allBranches;
    const branchIds = dto.branchIds ?? role.branchIds;
    this.assertValid(permissions, allBranches, branchIds);

    if (dto.name !== undefined) role.name = dto.name.trim();
    if (dto.description !== undefined)
      role.description = dto.description?.trim();
    if (dto.permissions !== undefined) {
      role.permissions = withImpliedViews(dto.permissions);
    }
    if (dto.allBranches !== undefined) role.allBranches = dto.allBranches;
    // allBranches=true ⇒ dọn branchIds; ngược lại lấy giá trị mới nếu có gửi.
    role.branchIds = allBranches ? [] : branchIds;
    return this.roles.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    const inUse = await this.customers.count({
      where: { staffRoleId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Vai trò đang được gán cho ${inUse} tài khoản — gỡ hoặc đổi vai trò các tài khoản đó trước khi xoá.`,
      );
    }
    await this.roles.remove(role);
  }

  /** Chặn gán quyền không hợp lệ (kể cả roles.manage/admins.manage vốn chỉ dành
   *  cho Super Admin) và bắt buộc chọn chi nhánh khi không phải allBranches. */
  private assertValid(
    permissions: string[],
    allBranches?: boolean,
    branchIds?: string[],
  ): void {
    const invalid = permissions.filter((p) => !isAssignablePermission(p));
    if (invalid.length) {
      throw new BadRequestException(
        `Quyền không hợp lệ hoặc không được phép gán: ${invalid.join(', ')}`,
      );
    }
    if (!allBranches && !(branchIds && branchIds.length)) {
      throw new BadRequestException(
        'Chọn ít nhất 1 chi nhánh, hoặc bật "mọi chi nhánh".',
      );
    }
  }
}
