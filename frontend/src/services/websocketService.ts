/**
 * WebSocket服务
 * 提供与后端的实时通信功能
 */

import { EventEmitter } from 'events';

// WebSocket连接状态
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

// 消息类型
export enum MessageType {
  MESSAGE = 'message',           // 普通消息
  STREAM_MESSAGE = 'stream_message', // 流式消息
  STREAM_START = 'stream_start',    // 流式消息开始
  STREAM_CHUNK = 'stream_chunk',    // 流式消息片段
  STREAM_END = 'stream_end',      // 流式消息结束
  ERROR = 'error',             // 错误消息
}

// 消息接口
export interface WebSocketMessage {
  type: string;
  id?: string;
  content?: string;
  timestamp?: string;
  conversation_id?: string;
}

// WebSocket客户端配置
interface WebSocketClientConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

/**
 * WebSocket客户端类
 * 提供WebSocket连接管理和消息收发功能
 */
class WebSocketClient extends EventEmitter {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private status: ConnectionStatus = ConnectionStatus.CLOSED;
  private clientId: string;

  constructor(config: WebSocketClientConfig) {
    super();
    this.url = config.url;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.clientId = this.generateClientId();

    // 注册事件处理器
    if (config.onOpen) this.on('open', config.onOpen);
    if (config.onClose) this.on('close', config.onClose);
    if (config.onError) this.on('error', config.onError);
    if (config.onMessage) this.on('message', config.onMessage);
    if (config.onReconnect) this.on('reconnect', config.onReconnect);
    if (config.onReconnectFailed) this.on('reconnectFailed', config.onReconnectFailed);
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取连接URL
   */
  private getConnectionUrl(): string {
    // 添加客户端ID作为路径参数
    const baseUrl = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
    return baseUrl + '/' + this.clientId;
  }

  /**
   * 获取当前连接状态
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 连接WebSocket服务器
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = ConnectionStatus.CONNECTING;
    this.socket = new WebSocket(this.getConnectionUrl());

    this.socket.onopen = () => {
      this.status = ConnectionStatus.OPEN;
      this.reconnectAttempts = 0;
      this.emit('open');
    };

    this.socket.onclose = () => {
      this.status = ConnectionStatus.CLOSED;
      this.emit('close');
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      this.emit('error', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.emit('message', message);
      } catch (error) {
        console.error('无法解析WebSocket消息:', error);
      }
    };
  }

  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnect', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * 发送消息
   */
  public send(message: WebSocketMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.emit('error', new Error('WebSocket未连接，无法发送消息'));
    }
  }

  /**
   * 发送普通消息
   */
  public sendMessage(content: string, conversationId?: string): void {
    this.send({
      type: MessageType.MESSAGE,
      content,
      conversation_id: conversationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送流式消息
   */
  public sendStreamMessage(content: string, conversationId?: string): void {
    this.send({
      type: MessageType.STREAM_MESSAGE,
      content,
      conversation_id: conversationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 关闭连接
   */
  public disconnect(): void {
    if (this.socket) {
      this.status = ConnectionStatus.CLOSING;
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// 创建WebSocket服务实例
const createWebSocketService = (config: WebSocketClientConfig) => {
  const client = new WebSocketClient(config);
  return client;
};

export default createWebSocketService;
