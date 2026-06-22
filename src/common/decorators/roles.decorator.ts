import { SetMetadata } from '@nestjs/common';
import { CustomerRole } from '../enums';

export const ROLES_KEY = 'roles';

/** Restrict a route to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: CustomerRole[]) => SetMetadata(ROLES_KEY, roles);
