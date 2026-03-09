/**
 * 对话类型定义
 */

// 对话消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sql?: string;
  visualType?: string;
  natural_language?: string;
  sql_query?: string;
  visualization_type?: string;
}

// 对话类型
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
