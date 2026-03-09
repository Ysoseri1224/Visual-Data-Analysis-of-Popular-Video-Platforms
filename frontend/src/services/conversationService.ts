/**
 * 会话管理服务
 * 提供会话和消息的本地存储和管理功能
 */
import apiService from '@/services/apiService';
// 消息接口
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sqlQuery?: string;
  timestamp: Date;
  modelType?: 'memory' | 't5' | 'deepseek';
}

// 会话接口
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  groupId?: string;
  currentModel: 't5' | 'deepseek';
}

// 会话分组接口
export interface ConversationGroup {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// 本地存储键
const STORAGE_KEYS = {
  CONVERSATIONS: 'ai_chat_conversations',
  GROUPS: 'ai_chat_groups'
};

/**
 * 从API获取所有会话
 * @returns 会话数组的Promise
 */
const getConversations = async (): Promise<Conversation[]> => {
  if (typeof window === 'undefined') return [];
  try {
    // 从API获取数据
    const parsedData = await apiService.getConversations();
    
    // 处理日期字段
    return parsedData.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: Array.isArray(conv.messages) && conv.messages.length > 0 ? 
        conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) : []
    }));
  } catch (error) {
    console.error('读取会话数据出错:', error);
    return [];
  }
};

/**
 * 从本地存储中获取所有分组
 * @returns 分组数组
 */
const getGroups = (): ConversationGroup[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedData = localStorage.getItem(STORAGE_KEYS.GROUPS);
    if (!storedData) return [];
    
    const parsedData = JSON.parse(storedData);
    
    // 处理日期字段
    return parsedData.map((group: any) => ({
      ...group,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt)
    }));
  } catch (error) {
    console.error('读取分组数据出错:', error);
    return [];
  }
};

/**
 * 保存会话到本地存储
 * @param conversations 要保存的会话数组
 */
const saveConversations = (conversations: Conversation[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch (error) {
    console.error('保存会话数据出错:', error);
  }
};

/**
 * 保存分组到本地存储
 * @param groups 要保存的分组数组
 */
const saveGroups = (groups: ConversationGroup[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  } catch (error) {
    console.error('保存分组数据出错:', error);
  }
};

/**
 * 根据ID获取会话（从本地缓存）
 * @param id 会话 ID
 * @returns 会话对象或空的Promise
 */
const getConversationById = async (id: string): Promise<Conversation | undefined> => {
  const conversations = await getConversations();
  return conversations.find(conv => conv.id === id);
};

/**
 * 根据ID获取会话详情（从服务器API获取完整信息）
 * @param id 会话 ID
 * @param messagePage 消息页码
 * @param messageLimit 每页消息数量
 * @returns 包含完整消息的会话对象的Promise
 */
const getConversationDetailById = async (
  id: string,
): Promise<Conversation | undefined> => {
  try {
    // 从服务器获取详细信息
    const data = await apiService.getConversationDetail(id);
    
    if (!data) return undefined;
    
    // 将服务器返回的数据转换为前端使用的Conversation格式
    let messages = [];
    
    // 处理不同的消息格式
    if (Array.isArray(data.messages)) {
      // 直接是消息数组
      messages = data.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.message,
        timestamp: new Date(msg.timestamp),
      }));
    } else if (data.messages && data.messages.data) {
      // 消息是对象的情况，有data属性
      messages = data.messages.data.map((msg: any) => ({
        role: msg.role,
        content: msg.message,
        timestamp: new Date(msg.timestamp),
      }));
    }
    
    return {
      id: data.id,
      title: data.title,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      messages,
      currentModel: data.current_model || 't5'
    };
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return undefined;
  }
};

/**
 * 创建新会话
 * @param title 会话标题
 * @returns 新创建的会话的Promise
 */
const createConversation = async (title: string): Promise<Conversation> => {
  const conversations = await getConversations();
  const now = new Date();
  
  const newConversation: Conversation = {
    id: `conv-${Date.now()}`,
    title: title || '新建会话',
    messages: [],
    createdAt: now,
    updatedAt: now,
    currentModel: 't5' // 默认使用T5模型
  };
  
  const updatedConversations = [newConversation, ...conversations];
  saveConversations(updatedConversations);
  
  return newConversation;
};

/**
 * 更新会话
 * @param id 会话 ID
 * @param updates 要更新的字段
 * @returns 更新后的会话或空的Promise
 */
const updateConversation = async (
  id: string,
  updates: Partial<Omit<Conversation, 'id' | 'createdAt'>>
): Promise<Conversation | undefined> => {
  const conversations = await getConversations();
  const index = conversations.findIndex(conv => conv.id === id);
  
  if (index === -1) return undefined;
  
  const updatedConversation = {
    ...conversations[index],
    ...updates,
    updatedAt: new Date()
  };
  
  conversations[index] = updatedConversation;
  saveConversations(conversations);
  
  return updatedConversation;
};

/**
 * 删除会话
 * @param id 会话 ID
 * @returns 是否删除成功的Promise
 */
const deleteConversation = async (id: string): Promise<boolean> => {
  const conversations = await getConversations();
  const filteredConversations = conversations.filter(conv => conv.id !== id);
  
  if (filteredConversations.length === conversations.length) {
    return false; // 未找到要删除的会话
  }
  
  saveConversations(filteredConversations);
  return true;
};

/**
 * 添加消息到会话
 * @param conversationId 会话 ID
 * @param message 要添加的消息
 * @returns 更新后的会话或空的Promise
 */
const addMessageToConversation = async (
  conversationId: string,
  message: Omit<Message, 'id' | 'timestamp'>
): Promise<Conversation | undefined> => {
  const conversations = await getConversations();
  const index = conversations.findIndex(conv => conv.id === conversationId);
  
  if (index === -1) return undefined;
  
  const newMessage: Message = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
  };
  
  const updatedMessages = [...conversations[index].messages, newMessage];
  
  // 生成会话标题（如果是第一条用户消息）
  let title = conversations[index].title;
  if (updatedMessages.length === 1 && message.role === 'user') {
    title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
  }
  
  const updatedConversation = {
    ...conversations[index],
    messages: updatedMessages,
    title,
    updatedAt: new Date()
  };
  
  conversations[index] = updatedConversation;
  saveConversations(conversations);
  
  return updatedConversation;
};

/**
 * 更新会话当前使用的模型
 * @param conversationId 会话 ID
 * @param model 新的模型类型
 * @returns 更新后的会话或空的Promise
 */
const updateConversationModel = async (
  conversationId: string,
  model: 't5' | 'deepseek'
): Promise<Conversation | undefined> => {
  return await updateConversation(conversationId, { currentModel: model });
};

/**
 * 创建新分组
 * @param name 分组名称
 * @returns 新创建的分组
 */
const createGroup = (name: string): ConversationGroup => {
  const groups = getGroups();
  const now = new Date();
  
  const newGroup: ConversationGroup = {
    id: `group-${Date.now()}`,
    name,
    createdAt: now,
    updatedAt: now
  };
  
  const updatedGroups = [...groups, newGroup];
  saveGroups(updatedGroups);
  
  return newGroup;
};

/**
 * 删除分组
 * @param groupId 分组 ID
 * @returns 是否删除成功的Promise
 */
const deleteGroup = async (groupId: string): Promise<boolean> => {
  const groups = getGroups();
  const filteredGroups = groups.filter(group => group.id !== groupId);
  
  if (filteredGroups.length === groups.length) {
    return false; // 未找到要删除的分组
  }
  
  saveGroups(filteredGroups);
  
  // 同时移除所有属于该分组的会话的分组引用
  const conversations = await getConversations();
  const updatedConversations = conversations.map(conv => {
    if (conv.groupId === groupId) {
      return { ...conv, groupId: undefined, updatedAt: new Date() };
    }
    return conv;
  });
  
  saveConversations(updatedConversations);
  return true;
};

/**
 * 将会话移动到分组
 * @param conversationId 会话 ID
 * @param groupId 分组 ID
 * @returns 更新后的会话或空的Promise
 */
const moveConversationToGroup = async (
  conversationId: string,
  groupId: string
): Promise<Conversation | undefined> => {
  return await updateConversation(conversationId, { groupId });
};

const conversationService = {
  getConversations,
  getGroups,
  getConversationById,
  getConversationDetailById,
  createConversation,
  updateConversation,
  deleteConversation,
  addMessageToConversation,
  updateConversationModel,
  createGroup,
  deleteGroup,
  moveConversationToGroup
};

export default conversationService;
