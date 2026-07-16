import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Phạm vi chi nhánh của tài khoản hiện tại (lấy từ `request.authContext` do
 *  PermissionsGuard gắn). `allBranches=true` ⇒ không giới hạn (super admin hoặc
 *  role bật mọi chi nhánh). */
export interface BranchScopeCtx {
  allBranches: boolean;
  branchIds: string[];
}

/** True nếu chi nhánh nằm trong phạm vi được phép. */
export function isBranchAllowed(
  scope: BranchScopeCtx,
  branchId?: string | null,
): boolean {
  if (scope.allBranches) return true;
  return !!branchId && scope.branchIds.includes(branchId);
}

/**
 * Inject phạm vi chi nhánh vào controller. Chỉ dùng trên route đã gắn
 * `@RequirePermission` (guard đảm bảo `authContext` tồn tại). Mặc định
 * `allBranches=true` nếu thiếu (route không phải RBAC — không giới hạn).
 */
export const BranchScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BranchScopeCtx => {
    const req = ctx.switchToHttp().getRequest();
    const a = req.authContext;
    return {
      allBranches: a?.allBranches ?? true,
      branchIds: a?.branchIds ?? [],
    };
  },
);
