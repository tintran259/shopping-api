import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface BackInStockMeta {
  productName: string;
  productSlug?: string;
  branchName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly storefrontUrl: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('resend.apiKey');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>('mail.from') ?? 'thongbao@example.com';
    this.storefrontUrl = config.get<string>('storefront.url') ?? 'http://localhost:3001';

    if (!this.resend) {
      this.logger.warn(
        '[MOCK] RESEND_API_KEY chưa cấu hình — email back-in-stock sẽ chỉ được log, không gửi thực.',
      );
    }
  }

  /**
   * Sends a back-in-stock notification to a single contact.
   * - Email address (contains "@") → sends via Resend.
   * - Phone number → logs a warning (SMS not yet implemented).
   * - Mock mode (no API key) → logs the email without sending.
   */
  async sendBackInStock(contact: string, meta: BackInStockMeta): Promise<void> {
    if (!contact.includes('@')) {
      this.logger.log(
        `[SMS-PENDING] Bỏ qua thông báo SMS cho ${contact} — tích hợp SMS chưa có.`,
      );
      return;
    }

    const productUrl = meta.productSlug
      ? `${this.storefrontUrl}/product/${meta.productSlug}`
      : this.storefrontUrl;
    const branchText = meta.branchName ? ` tại ${meta.branchName}` : '';

    if (!this.resend) {
      this.logger.log(
        `[MOCK] Email back-in-stock → ${contact} | ${meta.productName}${branchText}`,
      );
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to: contact,
      subject: `"${meta.productName}" đã có hàng trở lại!`,
      html: this.buildHtml({ productName: meta.productName, productUrl, branchText }),
    });
  }

  private buildHtml(p: {
    productName: string;
    productUrl: string;
    branchText: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#0f172a;background:#ffffff">
  <p style="margin:0 0 20px;font-size:13px;color:#64748b;letter-spacing:.04em;text-transform:uppercase;font-weight:600">
    Thông báo hàng về
  </p>
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3">
    🎉 Sản phẩm bạn đang chờ đã có hàng!
  </h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151">
    Sản phẩm <strong>${p.productName}</strong>${p.branchText} vừa được bổ sung kho.
    Đặt hàng ngay trước khi hết — số lượng có hạn!
  </p>
  <a href="${p.productUrl}"
     style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;letter-spacing:.02em">
    Mua ngay →
  </a>
  <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0">
  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
    Bạn nhận được email này vì đã đăng ký thông báo "có hàng" trên website.
    Nếu không phải bạn đăng ký, hãy bỏ qua email này.
  </p>
</body>
</html>`;
  }
}
