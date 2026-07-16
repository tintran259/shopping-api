import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Vai trò nhân viên back-office do Super Admin tạo/quản lý. Mỗi tài khoản admin
 * được gán đúng 01 role. Role gói:
 *  - `permissions`: danh sách quyền `<feature>.<view|manage>` (xem catalog ở
 *    `common/permissions.ts`).
 *  - phạm vi chi nhánh: `allBranches` = mọi chi nhánh, hoặc `branchIds` = danh
 *    sách chi nhánh cụ thể được phép (áp cho đơn hàng/tồn kho/dashboard).
 */
@Entity('staff_roles')
export class StaffRole extends BaseEntity {
  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ type: [String] })
  @Column({ type: 'simple-array', default: '' })
  permissions: string[];

  @ApiProperty({ description: 'Cho phép mọi chi nhánh (bỏ qua branchIds).' })
  @Column({ name: 'all_branches', default: false })
  allBranches: boolean;

  @ApiProperty({ type: [String], description: 'Chi nhánh được phép (uuid).' })
  @Column({ name: 'branch_ids', type: 'simple-array', default: '' })
  branchIds: string[];
}
