import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from './entities/notification.entity';

/** Phòng socket của một user. */
const roomOf = (userId: string) => `user:${userId}`;

/**
 * Realtime push cho Notification Center của BO. Client (BO) kết nối kèm JWT
 * (`handshake.auth.token`); ta xác thực bằng cùng `JwtService`/secret của REST,
 * rồi cho socket join phòng riêng theo userId. Server chỉ **đẩy** (`notification:new`
 * / `notification:count`) — mọi thao tác đọc/settings vẫn qua REST.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!raw) return client.disconnect();
    try {
      const payload = this.jwt.verify<{ sub: string }>(raw);
      if (!payload?.sub) return client.disconnect();
      void client.join(roomOf(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  /** Đẩy 1 thông báo mới + số chưa đọc tới đúng người nhận. */
  emitToUser(userId: string, notification: Notification, unreadCount: number) {
    if (!this.server) return; // gateway chưa init (vd trong test) → bỏ qua
    const room = this.server.to(roomOf(userId));
    room.emit('notification:new', notification);
    room.emit('notification:count', unreadCount);
  }
}
