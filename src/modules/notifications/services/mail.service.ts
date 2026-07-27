import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface BackInStockMeta {
  productName: string;
  productSlug?: string;
  branchName?: string;
  /** Ảnh sản phẩm (primary/variant) — điểm nhấn chính của email. */
  imageUrl?: string;
  /** Giá bán hiện tại (chuỗi numeric, vd "150000.00"). */
  price?: string;
  /** Giá gốc trước giảm — hiển thị gạch ngang nếu > price. */
  compareAtPrice?: string;
  currency?: string;
  shortDescription?: string;
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
    this.storefrontUrl =
      config.get<string>('storefront.url') ?? 'http://localhost:3001';

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

    if (!this.resend) {
      const priceText = this.formatMoney(meta.price, meta.currency);
      this.logger.log(
        `[MOCK] Email back-in-stock → ${contact} | ${meta.productName}` +
          `${meta.branchName ? ` @ ${meta.branchName}` : ''}` +
          `${priceText ? ` | ${priceText}` : ''} | ${productUrl}`,
      );
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to: contact,
      subject: `🎉 "${meta.productName}" đã có hàng trở lại!`,
      html: this.buildHtml(meta, productUrl),
    });
  }

  /** Định dạng tiền: VND → "150.000 ₫" (không phần thập phân), khác → theo currency. */
  private formatMoney(amount?: string, currency = 'VND'): string | null {
    if (amount == null || amount === '') return null;
    const n = Number(amount);
    if (Number.isNaN(n)) return null;
    if (currency === 'VND') {
      return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
    }
    return `${n.toLocaleString('vi-VN', { minimumFractionDigits: 2 })} ${currency}`;
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Email HTML — bố cục dạng bảng + inline style để tương thích Gmail/Outlook.
   * Toàn bộ email hướng sự chú ý vào 1 sản phẩm: ảnh lớn → tên → giá → nút mua.
   */
  private buildHtml(meta: BackInStockMeta, productUrl: string): string {
    const name = this.escape(meta.productName);
    const currency = meta.currency ?? 'VND';
    const price = this.formatMoney(meta.price, currency);
    const compareAt = this.formatMoney(meta.compareAtPrice, currency);
    const hasDiscount =
      meta.price != null &&
      meta.compareAtPrice != null &&
      Number(meta.compareAtPrice) > Number(meta.price);

    // ----- Ảnh hero (điểm nhấn) -----
    const imageBlock = meta.imageUrl
      ? `
      <tr>
        <td style="padding:0;background:#f8fafc">
          <a href="${productUrl}" style="display:block;text-decoration:none">
            <img src="${this.escape(meta.imageUrl)}" alt="${name}" width="600"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;object-fit:cover" />
          </a>
        </td>
      </tr>`
      : '';

    // ----- Mô tả ngắn -----
    const descBlock = meta.shortDescription
      ? `
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
        ${this.escape(meta.shortDescription)}
      </p>`
      : '';

    // ----- Giá -----
    const priceBlock = price
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
        <tr>
          <td style="font-size:26px;font-weight:800;color:#16a34a;padding-right:12px">${price}</td>
          ${
            hasDiscount && compareAt
              ? `<td style="font-size:16px;color:#94a3b8;text-decoration:line-through">${compareAt}</td>`
              : ''
          }
        </tr>
      </table>`
      : '';

    // ----- Badge chi nhánh còn hàng -----
    const branchBlock = meta.branchName
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
        <tr>
          <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:7px 16px;font-size:13px;font-weight:600;color:#047857">
            ✓ Còn hàng tại ${this.escape(meta.branchName)}
          </td>
        </tr>
      </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${name} đã có hàng trở lại</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    ${name} bạn đang chờ vừa có hàng trở lại — đặt ngay kẻo hết!
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
    <tr>
      <td align="center" style="padding:32px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

          <!-- Nhãn thông báo -->
          <tr>
            <td style="padding:24px 32px 4px">
              <span style="display:inline-block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#16a34a">
                🎉 Hàng về rồi
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px">
              <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:800;color:#0f172a">
                Sản phẩm bạn đang chờ đã có hàng trở lại!
              </h1>
            </td>
          </tr>

          ${imageBlock}

          <!-- Thông tin sản phẩm -->
          <tr>
            <td style="padding:28px 32px 8px">
              <h2 style="margin:0 0 10px;font-size:20px;line-height:1.4;font-weight:700;color:#0f172a">
                ${name}
              </h2>
              ${descBlock}
              ${priceBlock}
              ${branchBlock}

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:10px;background:#16a34a">
                    <a href="${productUrl}"
                       style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">
                      Xem &amp; Mua ngay →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:13px;color:#94a3b8">
                Số lượng có hạn — đặt sớm để không bỏ lỡ.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 32px 32px">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8">
                Bạn nhận được email này vì đã đăng ký thông báo "có hàng" cho sản phẩm trên.
                Nếu không phải bạn, hãy bỏ qua email này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
