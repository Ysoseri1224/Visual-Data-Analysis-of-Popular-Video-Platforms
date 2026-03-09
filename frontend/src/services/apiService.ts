/**
 * API服务
 * 提供与后端API的通信接口
 */

import axios from 'axios';

// 获取API地址
// 优先使用环境变量，否则使用默认值
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// 会话接口
export interface Conversation {
  id: string;
  title: string;
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  current_model?: string;
  message_count?: number;
}

// 消息接口
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sql_query?: string;
  timestamp: Date;
  parent_message_id?: string;
  model_type?: string;
}

// 会话分组接口
export interface ConversationGroup {
  id: string;
  name: string;
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  conversation_count?: number;
}

/**
 * 创建新的会话
 * @param title 会话标题
 * @param userId 可选的用户ID
 * @returns 创建的会话信息
 */
export const createConversation = async (title: string, userId?: string, currentModel?: string) => {
  try {
    // 发送POST请求到API
    const response = await axios.post(API_URL + '/AIchat/conversations', {
      title,
      user_id: userId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 记录响应信息
    console.log('响应数据：', response.data);
    
    // 返回响应数据
    return response.data;
  } catch (error: any) {
    console.error('创建会话失败:', error);
    throw error;
  }
};

/**
 * 删除会话及其相关消息
 * @param conversationId 会话ID
 * @returns 删除结果
 */
export const deleteConversation = async (conversationId: string) => {
  try {
    // 发送DELETE请求到API
    const response = await axios.delete(API_URL + '/AIchat/conversations/' + conversationId, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    // 返回响应数据
    return response.data;
  } catch (error: any) {
    console.error('删除会话失败:', error);
    throw error;
  }
};

/**
 * 获取会话列表
 * @param page 页码
 * @param limit 每页数量
 * @param sort 排序方式
 * @returns 会话列表数据
 */
export const getConversations = async (
  page: number = 1,
  limit: number = 20,
  sort: string = 'updated_at:desc'
) => {
  // : Conversation[]
  try {
    const params: any = { page, limit, sort};
    // 获取token
    const token = localStorage.getItem('token');
    
    // 发送GET请求到API
    const response = await axios.get(API_URL + '/AIchat/conversations', {
      params,
      headers: {
        // 'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    }); 
    // 处理日期字段
    const conversations = response.data.data
    // return {
    //   ...response.data,
    //   data: conversations
    // };
    return conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      messages: [],
      // messages: conv.messages.map((msg: any) => ({
      //   ...msg,
      //   timestamp: new Date(msg.timestamp)
      // }))
    }));
  } catch (error: any) {
    console.error('获取会话列表失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 获取会话详情
 * @param conversationId 会话ID
 * @returns 会话详情数据
 */
export const getConversationDetail = async (
  conversationId: string
) => {
  try {
    // 获取token
    const token = localStorage.getItem('token');
    const headers = {
      'Authorization': token ? `Bearer ${token}` : ''
    };
    
    // 分两步获取数据:
    // 1. 首先获取会话基本信息
    // 使用查询参数而非路径参数
    const conversationUrl = `${API_URL}/conversations/detail?id=${conversationId}`;
    
    const conversationResponse = await axios.get(conversationUrl, { headers });
    const conversationData = conversationResponse.data;

    // 处理日期字段
    const conversation = {
      ...conversationData,
      created_at: new Date(conversationData.created_at),
      updated_at: new Date(conversationData.updated_at)
    };
    
    return conversation;
  } catch (error: any) {
    console.error('获取会话详情失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 更新会话
 * @param conversationId 会话ID
 * @param updates 要更新的字段
 * @returns 更新后的会话数据
 */
export const updateConversation = async (
  conversationId: string,
  updates: {
    title?: string;
  }
) => {
  try {
    // 发送PUT请求到API
    const response = await axios.put(API_URL + '/AIchat/conversations/' + conversationId, updates, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 处理日期字段
    const updatedConversation = {
      ...response.data,
      created_at: new Date(response.data.created_at),
      updated_at: new Date(response.data.updated_at)
    };
    
    return updatedConversation;
  } catch (error: any) {
    console.error('更新会话失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 添加消息到会话
 * @param conversationId 会话ID
 * @param message 要添加的消息
 * @returns 添加的消息数据
 */
export const addMessage = async (
  conversationId: string,
  messageData: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    modelType?: 't5' | 'deepseek';
  }
) => {
  // 转换消息格式，将content改为message
  const formattedMessage = {
    role: messageData.role,
    message: messageData.content,  // 注意这里将content映射为message
    model_type: messageData.modelType,  // 添加模型类型
  };
  try {
    // 发送POST请求到API，会话ID放在请求体中
    const response = await axios.post(
      API_URL + '/conversations/messages', 
      {
        conversation_id: conversationId,
        message: formattedMessage
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    // 处理日期字段
    const addedMessage = {
      ...response.data,
      timestamp: new Date(response.data.timestamp)
    };
    
    return addedMessage;
  } catch (error: any) {
    console.error('添加消息失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 获取会话的消息列表
 * @param conversationId 会话ID
 * @param page 页码
 * @param limit 每页数量
 * @param role 角色筛选（可选）
 * @returns 消息列表数据
 */
export const getMessages = async (
  conversationId: string,
  page: number = 1,
  limit: number = 50,
  role?: 'user' | 'assistant' | 'system'
) => {
  try {
    // 构建查询参数
    const params: any = { page, limit };
    if (role) params.role = role;
    
    // 详细记录请求信息
    console.log('发送请求到:', API_URL + '/AIchat/conversations/' + conversationId + '/messages');
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    console.log('请求参数:', JSON.stringify(params, null, 2));
    
    // 发送GET请求到API
    const response = await axios.get(
      API_URL + '/AIchat/conversations/' + conversationId + '/messages',
      {
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 处理日期字段
    const messages = response.data.data.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    
    return {
      ...response.data,
      data: messages
    };
  } catch (error: any) {
    console.error('获取消息列表失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 更新消息
 * @param conversationId 会话ID
 * @param messageId 消息ID
 * @param updates 要更新的字段
 * @returns 更新后的消息数据
 */
export const updateMessage = async (
  conversationId: string,
  messageId: string,
  updates: {
    content?: string;
    sql_query?: string;
    parent_message_id?: string;
  }
) => {
  try {
    // 详细记录请求信息
    console.log('发送请求到:', API_URL + '/AIchat/conversations/' + conversationId + '/messages/' + messageId);
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    console.log('请求体:', JSON.stringify(updates, null, 2));
    
    // 发送PUT请求到API
    const response = await axios.put(
      API_URL + '/AIchat/conversations/' + conversationId + '/messages/' + messageId,
      updates,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 处理日期字段
    const updatedMessage = {
      ...response.data,
      timestamp: new Date(response.data.timestamp)
    };
    
    return updatedMessage;
  } catch (error: any) {
    console.error('更新消息失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 删除消息
 * @param conversationId 会话ID
 * @param messageId 消息ID
 * @returns 删除结果
 */
export const deleteMessage = async (
  conversationId: string,
  messageId: string
) => {
  try {
    // 详细记录请求信息
    console.log('发送删除请求到:', API_URL + '/AIchat/conversations/' + conversationId + '/messages/' + messageId);
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    
    // 发送DELETE请求到API
    const response = await axios.delete(
      API_URL + '/AIchat/conversations/' + conversationId + '/messages/' + messageId,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    return response.data;
  } catch (error: any) {
    console.error('删除消息失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 创建会话分组
 * @param name 分组名称
 * @returns 创建的分组数据
 */
export const createConversationGroup = async (name: string) => {
  try {
    // 详细记录请求信息
    console.log('发送请求到:', API_URL + '/AIchat/conversation-groups');
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    console.log('请求体:', JSON.stringify({ name }, null, 2));
    
    // 发送POST请求到API
    const response = await axios.post(API_URL + '/AIchat/conversation-groups', { name }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 处理日期字段
    const newGroup = {
      ...response.data,
      created_at: new Date(response.data.created_at),
      updated_at: new Date(response.data.updated_at)
    };
    
    return newGroup;
  } catch (error: any) {
    console.error('创建分组失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 获取会话分组列表
 * @returns 分组列表数据
 */
export const getConversationGroups = async () => {
  try {
    // 详细记录请求信息
    console.log('发送请求到:', API_URL + '/AIchat/conversation-groups');
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    
    // 发送GET请求到API
    const response = await axios.get(API_URL + '/AIchat/conversation-groups', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 处理日期字段
    const groups = response.data.data.map((group: any) => ({
      ...group,
      created_at: new Date(group.created_at),
      updated_at: new Date(group.updated_at)
    }));
    
    return {
      ...response.data,
      data: groups
    };
  } catch (error: any) {
    console.error('获取分组列表失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 更新会话分组
 * @param groupId 分组ID
 * @param name 新分组名称
 * @returns 更新后的分组数据
 */
export const updateConversationGroup = async (groupId: string, name: string) => {
  try {
    // 详细记录请求信息
    console.log('发送请求到:', API_URL + '/AIchat/conversation-groups/' + groupId);
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    console.log('请求体:', JSON.stringify({ name }, null, 2));
    
    // 发送PUT请求到API
    const response = await axios.put(API_URL + '/AIchat/conversation-groups/' + groupId, { name }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    // 处理日期字段
    const updatedGroup = {
      ...response.data,
      created_at: new Date(response.data.created_at),
      updated_at: new Date(response.data.updated_at)
    };
    
    return updatedGroup;
  } catch (error: any) {
    console.error('更新分组失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 删除会话分组
 * @param groupId 分组ID
 * @returns 删除结果
 */
export const deleteConversationGroup = async (groupId: string) => {
  try {
    // 详细记录请求信息
    console.log('发送删除请求到:', API_URL + '/AIchat/conversation-groups/' + groupId);
    console.log('请求头部:', JSON.stringify({
      'Content-Type': 'application/json'
    }, null, 2));
    
    // 发送DELETE请求到API
    const response = await axios.delete(API_URL + '/AIchat/conversation-groups/' + groupId, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 记录响应信息
    console.log('响应状态:', response.status);
    console.log('响应数据摘要:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    return response.data;
  } catch (error: any) {
    console.error('删除分组失败:', error);
    
    // 详细记录错误信息
    if (error.response) {
      console.error('错误状态:', error.response.status);
      console.error('错误数据:', error.response.data);
    }
    
    throw error;
  }
};

const apiService = {
  // 会话管理
  createConversation,
  getConversations,
  getConversationDetail,
  updateConversation,
  deleteConversation,
  
  // 消息管理
  addMessage,
  getMessages,
  updateMessage,
  deleteMessage,
  
  // 分组管理
  createConversationGroup,
  getConversationGroups,
  updateConversationGroup,
  deleteConversationGroup
};

export default apiService;
