import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const UPLOAD_DIR = './uploads';

interface OpenAiConfig {
  apiKey: string;
  imageModel: string;
  imageSize: string;
}

/**
 * Sinh ảnh sản phẩm bằng AI rồi lưu vào cùng thư mục `./uploads` như ảnh tải lên,
 * nên sản phẩm luôn giữ URL của chính hệ thống (không phải link tạm của nhà cung
 * cấp — link đó hết hạn). Tách lớp provider: hiện dùng OpenAI; đổi provider chỉ
 * cần sửa `generateBytes`. Key rỗng ⇒ chế độ mock (trả SVG placeholder).
 */
@Injectable()
export class ImageGenService {
  private readonly logger = new Logger(ImageGenService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): OpenAiConfig {
    return this.config.get<OpenAiConfig>('openai')!;
  }

  /** Sinh ảnh từ mô tả, lưu file, trả về tên file trong `./uploads`. */
  async generate(prompt: string): Promise<string> {
    const { bytes, ext } = this.cfg.apiKey
      ? await this.generateBytes(prompt)
      : this.mockImage(prompt);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `ai-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), bytes);
    return filename;
  }

  /** Gọi API OpenAI (gpt-image-1) — trả ảnh base64 → PNG. */
  private async generateBytes(
    prompt: string,
  ): Promise<{ bytes: Buffer; ext: string }> {
    const { apiKey, imageModel, imageSize } = this.cfg;
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageModel,
          prompt,
          n: 1,
          size: imageSize,
        }),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được dịch vụ tạo ảnh.');
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(
        `OpenAI image gen ${res.status}: ${detail.slice(0, 300)}`,
      );
      throw new BadGatewayException('Dịch vụ tạo ảnh trả về lỗi. Thử lại sau.');
    }

    const json = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64)
      throw new BadGatewayException('Dịch vụ tạo ảnh không trả về ảnh.');
    return { bytes: Buffer.from(b64, 'base64'), ext: 'png' };
  }

  /** Placeholder khi chưa cấu hình key — SVG có nhãn để không nhầm là ảnh thật. */
  private mockImage(prompt: string): { bytes: Buffer; ext: string } {
    this.logger.warn(
      `[MOCK] OPENAI_API_KEY chưa cấu hình — trả ảnh placeholder`,
    );
    const safe = prompt
      .slice(0, 120)
      .replace(
        /[&<>]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
      );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#e9eef5"/>
  <text x="512" y="470" font-family="sans-serif" font-size="40" fill="#64748b" text-anchor="middle" font-weight="700">MOCK · ẢNH AI</text>
  <text x="512" y="540" font-family="sans-serif" font-size="26" fill="#94a3b8" text-anchor="middle">${safe}</text>
</svg>`;
    return { bytes: Buffer.from(svg, 'utf8'), ext: 'svg' };
  }
}
