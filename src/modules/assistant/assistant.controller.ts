import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomerRole } from '../../common/enums';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssistantService } from './assistant.service';
import { ChatDto } from './dto/chat.dto';

/**
 * Trợ lý AI Back Office. Chỉ tài khoản BO (admin/super_admin) dùng được; nội dung
 * tự giới hạn theo quyền + phạm vi chi nhánh (service tự giải quyết từ DB).
 */
@ApiTags('admin/assistant')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(CustomerRole.ADMIN, CustomerRole.SUPER_ADMIN)
@Controller('admin/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @ApiOperation({
    summary:
      'Hỏi trợ lý AI (SSE stream: event token/tool/done/error). Read-only, ' +
      'chỉ trả lời nghiệp vụ BO trong phạm vi quyền + chi nhánh của tài khoản.',
  })
  chat(
    @Body() dto: ChatDto,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    return this.assistant.streamChat(dto, userId, res);
  }
}
