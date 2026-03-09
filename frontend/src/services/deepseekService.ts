/**
 * DeepSeek服务
 * 提供与DeepSeek API相关的接口调用
 */

import axios from 'axios';
import databaseSchemaPrompt from '@/config/database-schema';

// 获取API基础URL，优先使用环境变量，否则使用代理路径
// 修改为使用Next.js代理，避免跨域问题
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';

// DeepSeek API密钥，从环境变量中获取
const DEEPSEEK_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';

// 直接使用硬编码密钥进行开发测试
// 注意: 在生产环境中应该使用环境变量或其他安全的方式管理密钥

// 使用硬编码密钥
// 正常生产环境的代码应使用环境变量或其他安全方式管理密钥
const DEEPSEEK_HARDCODED_KEY = 'sk-7a57e3ba6a1b48cf9d4ed7e7ea1bbce5'; // 已确认密钥正确

// 获取当前可用的API密钥
const getCurrentApiKey = () => {
  return DEEPSEEK_API_KEY || DEEPSEEK_HARDCODED_KEY;
}

// 消息接口
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 聊天请求接口
export interface ChatRequest {
  messages: Message[];

  systemPrompt?: string;
  conversation_id?: string; // 对话 ID，用于认证对话模式
}

// 聊天响应接口
export interface ChatResponse {
  id: string;
  content: string;
  sql?: string;
  visualizationType?: string;
}

// SQL分析请求接口
export interface SqlAnalysisRequest {
  query: string;
}

// SQL分析响应接口
export interface SqlAnalysisResponse {
  sql: string;
  visualization_type: string;
  explanation: string;
}

/**
 * 发送聊天请求
 * @param request 聊天请求参数
 * @returns 发送聊天请求到DeepSeek API
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  // 确保消息数组非空
  if (!request.messages || request.messages.length === 0) {
    throw new Error('消息数组不能为空');
  }
  
  try {
    // 详细记录请求信息
    console.log('发送非流式请求到:', API_URL + '/AIchat');
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getCurrentApiKey().substring(0, 10) + '...'
    }, null, 2));
    console.log('请求体:', JSON.stringify(request, null, 2));
    
    // 发送POST请求到API
    const response = await axios.post(API_URL + '/AIchat', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getCurrentApiKey()
      }
    });
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应头部:', response.headers);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 返回响应数据
    return response.data;
  } catch (error: any) {
    console.error('DeepSeek API 调用失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      // 服务器响应了错误状态码
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
      console.error('错误头部:', error.response.headers);
    } else if (error.request) {
      // 请求发送了但没有收到响应
      console.error('没有收到响应:', error.request);
    } else {
      // 其他错误
      console.error('错误消息:', error.message);
    }
    
    // 测试API服务器连通性
    try {
      console.log('测试API服务器连通性...');
      const testResponse = await fetch(API_URL.split('/api')[0], { method: 'HEAD' });
      console.log('API服务器连通性测试结果:', testResponse.status, testResponse.statusText);
    } catch (e) {
      console.error('API服务器连通性测试失败:', e);
    }
    
    throw error;
  }
};

/**


/**
 * 分析SQL查询
 * @param request SQL分析请求参数
 * @returns SQL分析响应
 */
const analyzeSqlQuery = async (request: SqlAnalysisRequest): Promise<SqlAnalysisResponse> => {
  const response = await axios.post(`${API_URL}/query/analyze`, request, {
    withCredentials: true
  });
  return response.data;
};

const deepseekService = {
  sendChatRequest,
  analyzeSqlQuery
};

export default deepseekService;
