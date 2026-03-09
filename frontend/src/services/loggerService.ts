/**
 * 日志服务
 * 负责收集和发送系统各模块的日志信息
 */
import axios from 'axios';

// API基础URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// 日志级别定义
export type LogLevel = 'info' | 'warning' | 'error';

// 日志来源模块定义
export type LogSource = '对话模块' | '数据可视化模块' | '数据管理模块';

// 日志条目接口
export interface LogEntry {
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: string;
  userId?: string;
}

/**
 * 发送日志到后端
 * @param logEntry 日志条目
 * @returns 是否发送成功
 */
const sendLog = async (logEntry: LogEntry): Promise<boolean> => {
  try {
    // 获取token
    const token = localStorage.getItem('token');
    
    // 发送日志
    await axios.post(
      `${API_URL}/logs`, 
      logEntry,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      }
    );
    
    return true;
  } catch (error) {
    // 如果发送失败，在控制台记录错误
    console.error('发送日志失败:', error);
    return false;
  }
};

/**
 * 记录信息级别日志
 * @param source 日志来源模块
 * @param message 日志消息
 * @param details 可选的详细信息
 */
const info = async (source: LogSource, message: string, details?: string): Promise<void> => {
  const userId = localStorage.getItem('userId');
  
  // 发送日志到后端
  await sendLog({
    level: 'info',
    source,
    message,
    details,
    userId: userId || undefined
  });
  
  // 同时在控制台记录
  console.info(`[${source}] ${message}`, details ? details : '');
};

/**
 * 记录警告级别日志
 * @param source 日志来源模块
 * @param message 日志消息
 * @param details 可选的详细信息
 */
const warning = async (source: LogSource, message: string, details?: string): Promise<void> => {
  const userId = localStorage.getItem('userId');
  
  // 发送日志到后端
  await sendLog({
    level: 'warning',
    source,
    message,
    details,
    userId: userId || undefined
  });
  
  // 同时在控制台记录
  console.warn(`[${source}] ${message}`, details ? details : '');
};

/**
 * 记录错误级别日志
 * @param source 日志来源模块
 * @param message 日志消息
 * @param details 可选的详细信息或错误堆栈
 */
const error = async (source: LogSource, message: string, details?: string): Promise<void> => {
  const userId = localStorage.getItem('userId');
  
  // 发送日志到后端
  await sendLog({
    level: 'error',
    source,
    message,
    details,
    userId: userId || undefined
  });
  
  // 同时在控制台记录
  console.error(`[${source}] ${message}`, details ? details : '');
};

/**
 * 记录API调用错误
 * @param source 日志来源模块
 * @param apiPath API路径
 * @param errorObj 错误对象
 */
const apiError = async (source: LogSource, apiPath: string, errorObj: any): Promise<void> => {
  let errorMessage = `API调用失败: ${apiPath}`;
  let errorDetails = '';
  
  // 提取错误详情
  if (errorObj.response) {
    errorDetails = `状态码: ${errorObj.response.status}, 数据: ${JSON.stringify(errorObj.response.data)}`;
  } else if (errorObj.request) {
    errorDetails = '无响应';
  } else {
    errorDetails = errorObj.message || '未知错误';
  }
  
  // 记录错误
  await error(source, errorMessage, errorDetails);
};

const loggerService = {
  info,
  warning,
  error,
  apiError
};

export default loggerService;
