import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** What the BO needs to open the Strapi admin panel already logged in. */
export interface CmsLoginToken {
  /** Strapi admin JWT (lifetime = Strapi `config/admin` expiresIn, ~1 year). */
  token: string;
  /** CMS origin, e.g. `http://localhost:1337` — postMessage targetOrigin. */
  cmsUrl: string;
  /** Public bridge page that writes the token into the admin localStorage. */
  ssoUrl: string;
}

/**
 * Mints a Strapi **admin** JWT for the Back Office CMS auto-login.
 *
 * All BO users share one Strapi admin identity (a service account whose
 * credentials live in `CMS_BRIDGE_EMAIL`/`CMS_BRIDGE_PASSWORD`) — the CMS holds
 * "marketing content only", so per-user admin accounts aren't worth the
 * provisioning cost. We call Strapi's own `POST /admin/login` (not an API
 * token — those authenticate the content API, not the admin panel) and pass
 * the returned JWT to the BO, which delivers it to a public bridge page on the
 * CMS origin. The token's 1-year lifetime is set on the CMS side
 * (`config/admin.ts` `auth.options.expiresIn`), not here.
 */
@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  /**
   * Re-use the last minted admin JWT instead of logging into Strapi on every
   * click — the token lives ~1 year, and Strapi rate-limits `/admin/login`
   * (repeated nav clicks would 429). Cached until 1 day before its own `exp`.
   */
  private cached?: { token: string; expMs: number };

  constructor(private readonly config: ConfigService) { }

  async getLoginToken(): Promise<CmsLoginToken> {
    const url = this.config.get<string>('cms.url')!;
    const ssoPath = this.config.get<string>('cms.ssoPath')!;
    const email = this.config.get<string>('cms.bridgeEmail');
    const password = this.config.get<string>('cms.bridgePassword');

    if (!email || !password) {
      throw new ServiceUnavailableException(
        'Tính năng CMS chưa được cấu hình (thiếu CMS_BRIDGE_EMAIL/PASSWORD).',
      );
    }

    const base = { cmsUrl: url, ssoUrl: `${url}${ssoPath}` };
    if (this.cached && this.cached.expMs - 86_400_000 > Date.now()) {
      return { token: this.cached.token, ...base };
    }

    let res: Response;
    try {
      res = await fetch(`${url}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      this.logger.error(`Không gọi được CMS (${url}): ${String(err)}`);
      throw new BadGatewayException('Không kết nối được tới CMS.');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`CMS login thất bại (${res.status}): ${body}`);
      throw new BadGatewayException(
        res.status === 400 || res.status === 401
          ? 'Sai thông tin tài khoản CMS cầu nối — kiểm tra CMS_BRIDGE_EMAIL/PASSWORD.'
          : 'CMS từ chối đăng nhập.',
      );
    }

    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) {
      throw new BadGatewayException('CMS không trả về token đăng nhập.');
    }

    this.cached = { token, expMs: jwtExpiryMs(token) };
    return { token, ...base };
  }
}

/** Đọc `exp` (giây) từ payload JWT → ms. Mặc định 7 ngày nếu không đọc được. */
function jwtExpiryMs(token: string): number {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { exp?: number };
    if (typeof json.exp === 'number') return json.exp * 1000;
  } catch {
    // ignore — fall through to default
  }
  return Date.now() + 7 * 86_400_000;
}
