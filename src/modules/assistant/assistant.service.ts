import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { buildAuthContext } from '../auth/auth-context';
import { BranchesService } from '../branches/services/branches.service';
import { InventoryService } from '../branches/services/inventory.service';
import { CustomersService } from '../customers/services/customers.service';
import { OrdersService } from '../orders/services/orders.service';
import { buildSystemPrompt } from './assistant.prompt';
import {
  ASSISTANT_TOOLS,
  AssistantCtx,
  AssistantTool,
  ToolServices,
} from './assistant.tools';
import { ChatDto } from './dto/chat.dto';

interface AiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  maxToolIterations: number;
  enabled: boolean;
}

/**
 * Trợ lý AI của Back Office. Chạy hoàn toàn server-side (API key không lộ ra FE),
 * giải quyết phân quyền từ DB, chỉ đưa cho model những tool mà tài khoản có quyền,
 * và stream kết quả về FE qua SSE. v1 read-only.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly services: ToolServices;

  constructor(
    private readonly config: ConfigService,
    private readonly customers: CustomersService,
    orders: OrdersService,
    inventory: InventoryService,
    branches: BranchesService,
  ) {
    this.services = { orders, inventory, branches };
  }

  private get ai(): AiConfig {
    return this.config.get<AiConfig>('ai')!;
  }

  /** Ghi một event SSE. */
  private sse(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  async streamChat(dto: ChatDto, userId: string, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const ai = this.ai;
      if (!ai.enabled || !ai.apiKey) {
        this.sse(res, 'error', {
          message: 'Trợ lý AI chưa được cấu hình (thiếu ANTHROPIC_API_KEY).',
        });
        res.end();
        return;
      }

      const customer = await this.customers.findByIdWithStaffRole(userId);
      if (!customer) {
        this.sse(res, 'error', { message: 'Không tìm thấy tài khoản.' });
        res.end();
        return;
      }
      const authCtx = buildAuthContext(customer);
      const ctx: AssistantCtx = {
        userId,
        permissions: authCtx.permissions,
        isSuperAdmin: authCtx.isSuperAdmin,
        scope: {
          allBranches: authCtx.allBranches,
          branchIds: authCtx.branchIds,
        },
      };

      // Chỉ expose tool mà tài khoản có quyền ⇒ model không thể gọi ngoài quyền.
      const tools = ASSISTANT_TOOLS.filter(
        (t) =>
          !t.requiredPermission ||
          ctx.isSuperAdmin ||
          ctx.permissions.includes(t.requiredPermission),
      );
      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));

      const client = new Anthropic({ apiKey: ai.apiKey });
      const system = buildSystemPrompt(ctx, tools, dto.context?.route);
      const messages: Anthropic.MessageParam[] = dto.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      for (let i = 0; i < ai.maxToolIterations; i++) {
        const stream = client.messages.stream({
          model: ai.model,
          max_tokens: ai.maxTokens,
          system,
          messages,
          tools: anthropicTools,
        });
        stream.on('text', (delta) => this.sse(res, 'token', { text: delta }));
        const final = await stream.finalMessage();

        const toolUses = final.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        if (toolUses.length === 0) break; // model đã trả lời xong

        messages.push({
          role: 'assistant',
          content: final.content as Anthropic.ContentBlockParam[],
        });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          this.sse(res, 'tool', { name: tu.name });
          const result = await this.runTool(tools, tu, ctx);
          results.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        messages.push({ role: 'user', content: results });
      }

      this.sse(res, 'done', {});
      res.end();
    } catch (err) {
      this.logger.error('Assistant stream failed', err as Error);
      this.sse(res, 'error', {
        message: 'Trợ lý gặp sự cố khi xử lý. Vui lòng thử lại.',
      });
      res.end();
    }
  }

  /** Thực thi một tool, có double-check quyền (defense-in-depth). */
  private async runTool(
    tools: AssistantTool[],
    tu: Anthropic.ToolUseBlock,
    ctx: AssistantCtx,
  ): Promise<unknown> {
    const tool = tools.find((t) => t.name === tu.name);
    try {
      if (!tool) throw new Error('Công cụ không tồn tại');
      if (
        tool.requiredPermission &&
        !ctx.isSuperAdmin &&
        !ctx.permissions.includes(tool.requiredPermission)
      ) {
        return { error: 'Bạn không có quyền dùng chức năng này.' };
      }
      return await tool.execute(
        (tu.input ?? {}) as Record<string, unknown>,
        ctx,
        this.services,
      );
    } catch (e) {
      this.logger.warn(`Tool ${tu.name} lỗi: ${(e as Error).message}`);
      return { error: 'Không lấy được dữ liệu cho yêu cầu này.' };
    }
  }
}
