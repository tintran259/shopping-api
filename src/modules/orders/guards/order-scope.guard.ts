import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BranchScopeCtx,
  isBranchAllowed,
} from '../../../common/decorators/branch-scope.decorator';
import { Order } from '../entities/order.entity';

/**
 * Giới hạn thao tác đơn hàng theo chi nhánh được phép của tài khoản. Chạy sau
 * PermissionsGuard (đã gắn `request.authContext`):
 *  - Route có `:id` → nạp `branch_id` của đơn, chặn nếu ngoài phạm vi.
 *  - Route tạo đơn (`body.branchId`) → chặn nếu chi nhánh ngoài phạm vi.
 *  - List/summary (không id, không branchId) → bỏ qua (service tự lọc query).
 * Super admin / role mọi chi nhánh → luôn qua.
 */
@Injectable()
export class OrderScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const scope: BranchScopeCtx = {
      allBranches: req.authContext?.allBranches ?? true,
      branchIds: req.authContext?.branchIds ?? [],
    };
    if (scope.allBranches) return true;

    const id: string | undefined = req.params?.id;
    if (id) {
      const order = await this.orders.findOne({
        where: { id },
        select: { id: true, branchId: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (!isBranchAllowed(scope, order.branchId)) {
        throw new ForbiddenException(
          'Đơn hàng thuộc chi nhánh ngoài phạm vi của bạn',
        );
      }
      return true;
    }

    const bodyBranchId: string | undefined = req.body?.branchId;
    if (bodyBranchId && !isBranchAllowed(scope, bodyBranchId)) {
      throw new ForbiddenException(
        'Bạn chỉ được tạo đơn cho chi nhánh trong phạm vi của mình',
      );
    }
    return true;
  }
}
