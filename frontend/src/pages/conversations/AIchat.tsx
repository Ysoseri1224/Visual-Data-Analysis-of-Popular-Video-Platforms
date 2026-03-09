/**
 * SQL数据可视化聊天页面
 * 支持多模型切换、流式响应和会话管理
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MessageItem from '@/components/chat/MessageItem';
import ConversationSidebar from '@/components/chat/ConversationSidebar';
import conversationService, { Message, Conversation, ConversationGroup } from '@/services/conversationService';
import modelService from '@/services/modelService';
import apiService from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';

const AIChat: React.FC = () => {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth(); // 获取当前登录用户信息
  
  // 状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  

  
  // 当前选择的模型
  const [currentModel, setCurrentModel] = useState<'t5' | 'deepseek'>('deepseek');
  
  // 初始化数据
  useEffect(() => {
    loadConversations();
    loadGroups();
  }, []);
  
  // 加载对话数据
  const loadConversations = async () => {
    try {
      const loadedConversations = await conversationService.getConversations();
      setConversations(loadedConversations);
      
      // 如果有对话，选择第一个
      if (loadedConversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(loadedConversations[0].id);
      }
    } catch (error) {
      console.error('加载对话列表失败：', error);
    }
  };
  
  // 加载分组数据
  const loadGroups = () => {
    const loadedGroups = conversationService.getGroups();
    setGroups(loadedGroups);
  };
  
  // 当选中的对话改变时更新当前对话
  useEffect(() => {
    const loadConversationDetail = async () => {
      if (selectedConversationId) {
        try {
          // 从后端获取详细信息（包含全部消息）
          const detailedConversation = await conversationService.getConversationDetailById(selectedConversationId);
          console.log("我选中的什么：", detailedConversation);
          if (detailedConversation) {
            setCurrentConversation(detailedConversation);
          }
        } catch (error) {
          console.error('获取对话详情失败:', error);
        }
      } else {
        setCurrentConversation(null);
      }
    };
    
    loadConversationDetail();
  }, [selectedConversationId, conversations]);
  
  // 消息区域自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 创建新对话
  const handleNewConversation = async () => {
    try {
      // 调用后端API创建新对话，传入用户ID
      const response = await apiService.createConversation('新对话', user?.id);
      console.log('创建对话成功:', response);
      
      // 创建本地对话记录
      // 直接使用后端返回的ID创建本地对话
      // 首先删除原来的对话（如果存在）
      const existingConversation = await conversationService.getConversationById(response.id);
      if (existingConversation) {
        await conversationService.deleteConversation(response.id);
      }
      
      // 修改本地存储中的对话数组
      const conversations = await conversationService.getConversations();
      const now = new Date();
      
      const newConversation: Conversation = {
        id: response.id,
        title: response.title || '新对话',
        messages: [],
        createdAt: now,
        updatedAt: now,
        currentModel: 't5' // 默认使用T5模型
      };
      
      // 手动保存到本地存储
      const updatedConversations = [newConversation, ...conversations.filter(c => c.id !== response.id)];
      localStorage.setItem('ai_chat_conversations', JSON.stringify(updatedConversations));
      
      loadConversations();
      setSelectedConversationId(response.id);
    } catch (error) {
      console.error('创建对话失败:', error);
      // 显示错误消息
      alert(`无法创建新对话: ${error instanceof Error ? error.message : '服务器错误'}`);
      // 重新加载对话列表
      loadConversations();
    }
  };
  
  // 重命名对话
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      // 调用API更新对话标题
      await apiService.updateConversation(id, { title: newTitle });
      
      // 重新加载对话列表
      await loadConversations();
      
      // 如果当前选中的是被重命名的对话，则刷新当前对话详情
      if (selectedConversationId === id) {
        try {
          const updatedConversation = await conversationService.getConversationDetailById(id);
          if (updatedConversation) {
            setCurrentConversation(updatedConversation);
          }
        } catch (error) {
          console.error('获取更新后的对话详情失败:', error);
        }
      }
    } catch (error) {
      console.error('重命名对话失败:', error);
      alert(`重命名对话失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  // 删除对话
  const handleDeleteConversation = async (id: string) => {
    // 显示确认对话框
    if (!window.confirm('确定要删除此对话吗？这将删除该对话的所有消息记录。')) {
      return; // 用户取消删除
    }
    
    try {
      // 调用后端API删除对话及其相关消息
      const response = await apiService.deleteConversation(id);
      console.log('删除对话成功:', response);
      
      // 删除本地对话记录
      conversationService.deleteConversation(id);
      loadConversations();
      
      // 更新选中的对话
      if (selectedConversationId === id) {
        const remainingConversations = conversations.filter(c => c.id !== id);
        if (remainingConversations.length > 0) {
          setSelectedConversationId(remainingConversations[0].id);
        } else {
          setSelectedConversationId(null);
        }
      }
    } catch (error) {
      console.error('删除对话失败:', error);
      alert(`删除对话失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  // 创建分组
  const handleCreateGroup = (name: string) => {
    conversationService.createGroup(name);
    loadGroups();
  };
  
  // 移动对话到分组
  const handleMoveToGroup = (conversationId: string, groupId: string) => {
    conversationService.moveConversationToGroup(conversationId, groupId);
    loadConversations();
  };
  
  // 切换模型 - 更新前端状态和本地存储
  const handleModelSwitch = (model: 't5' | 'deepseek') => {
    if (!currentConversation) return;
    
    // 更新当前模型状态
    setCurrentModel(model);
    
    // 同时更新当前对话的模型属性
    const updatedConversation = {
      ...currentConversation,
      currentModel: model
    };
    
    setCurrentConversation(updatedConversation);
    
    // 保存到本地存储
    conversationService.updateConversationModel(currentConversation.id, model);
    
    console.log(`模型已切换为: ${model}`);
  };
  
  // 前往数据可视化页面
  const handleVisualizeClick = () => {
    // 简化逻辑，直接获取最新的一对问答
    let latestAssistantMessage = "";
    let latestUserQuestion = "";
    
    if (currentConversation && currentConversation.messages.length >= 2) {
      const messages = currentConversation.messages;
      
      // 获取最新的助手消息和用户消息
      let assistantMessageFound = false;
      
      // 从最新消息开始逆序遍历
      for (let i = messages.length - 1; i >= 0; i--) {
        if (!assistantMessageFound && messages[i].role === 'assistant') {
          // 找到最新的助手消息
          latestAssistantMessage = messages[i].content || "";
          assistantMessageFound = true;
          continue;
        }
        
        if (assistantMessageFound && messages[i].role === 'user') {
          // 找到并且上一条是助手消息，则这就是我们要找的用户消息
          latestUserQuestion = messages[i].content || "";
          break;
        }
      }
    }
    
    if (!latestAssistantMessage) {
      alert('没有找到助手消息，请先进行对话');
      return;
    }
    
    // 逆向URL编码消息，作为URL参数传递
    const encodedSql = encodeURIComponent(latestAssistantMessage);
    const encodedQuestion = encodeURIComponent(latestUserQuestion);
    
    // 使用路由跳转到数据可视化页面，并传递参数
    router.push(`/data/visual?sql=${encodedSql}&question=${encodedQuestion}`);
  };
  
  // 这里的代码已被移动到上面的handleVisualizeClick函数中
  
  // 发送消息
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !currentConversation) return;
    
    const userInput = input.trim();
    setInput('');
    setIsLoading(true);
    
    try {
      // 生成临时消息 ID
      const tempId = 'temp-' + Date.now();
      const timestamp = new Date();
      
      // 先在本地添加用户消息，立即显示在界面上
      const userMessage = {
        id: tempId,
        role: 'user' as const,
        content: userInput,
        message: userInput, // 同时设置 message 和 content 属性
        timestamp: timestamp,
        modelType: currentModel
      };
      
      // 先更新本地对话状态，立即在界面上显示用户消息
      const updatedConversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage]
      };
      setCurrentConversation(updatedConversation);
      
      // 自动滚动到底部
      setTimeout(() => scrollToBottom(), 100);
      
      // 异步发送到服务器
      const response = await apiService.addMessage(currentConversation.id, {
        role: 'user',
        content: userInput,
        modelType: currentModel  // 添加当前选择的模型
      });

      if (!response) {
        throw new Error('无法添加消息');
      }
      
      console.log('服务器响应成功:', response);
      
      // 刷新对话列表以获取最新数据（包括系统响应）
      await loadConversations();
      
      // 只有在成功接收到响应后才设置isLoading为false
      setIsLoading(false);
    } catch (error) {
      console.error('处理消息错误:', error);
      setIsLoading(false);
      
      if (currentConversation) {
        // 在本地添加错误消息
        conversationService.addMessageToConversation(currentConversation.id, {
          role: 'system',
          content: `系统错误: ${error instanceof Error ? error.message : '发生未知错误'}`
        });
        
        loadConversations();
      }
    }
  };
  
  return (
    <DashboardLayout title="SQL数据可视化聊天">
      {/* 注意: h-[calc(100vh-64px)]确保高度正好是视窗高度减去导航栏高度 */}
      <div className="flex h-[calc(100vh-170px)] bg-gray-900 text-white overflow-hidden">
        {/* 侧边栏按钮 */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed left-0 top-1/2 transform -translate-y-1/2 bg-gray-800 p-2 rounded-r-md z-10"
        >
          {isSidebarOpen ? '\←' : '\→'}
        </button>
        
        {/* 侧边栏 - 固定宽度和高度 */}
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            className="h-full w-72 flex-shrink-0 overflow-hidden border-r border-gray-800"
          >
            <div className="h-full overflow-y-auto">
              <ConversationSidebar
                conversations={conversations}
                groups={groups}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                onNewConversation={handleNewConversation}
                onRenameConversation={handleRenameConversation}
                onDeleteConversation={handleDeleteConversation}
                onCreateGroup={handleCreateGroup}
                onMoveToGroup={handleMoveToGroup}
              />
            </div>
          </motion.div>
        )}
        
        {/* 主聊天区域 - 布局固定 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* 消息区域 - 只有这里有滚动条 */}
          <div className="flex-1 p-4 overflow-y-auto" id="message-container">
            {currentConversation ? (
              <div className="pb-4">
                {/* 对话标题 */}
                <h2 className="text-xl font-bold mb-6 text-center text-blue-400">
                  {currentConversation.title}
                </h2>
                
                {/* 消息列表 */}
                {currentConversation.messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">
                    <p className="text-lg mb-4">这是一个新的对话。开始提问吧！</p>
                    <p>例如: "帮我生成一个SQL查询，显示过去一周内每天的用户注册数"</p>
                  </div>
                ) : (
                  <div>
                    {currentConversation.messages.map((message) => (
                      <MessageItem
                        key={message.id}
                        id={message.id}
                        role={message.role}
                        content={message.content}
                        message={message.content || ''} /* 确保同时传递content和message属性 */
                        sqlQuery={message.sqlQuery}
                        timestamp={message.timestamp}
                        modelType={message.modelType}
                        onModelSwitch={handleModelSwitch}
                        onVisualizeClick={handleVisualizeClick}
                      />
                    ))}
                    

                  </div>
                )}
                
                {/* 用于自动滚动到底部的引用 */}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl mb-4">欢迎使用SQL数据可视化聊天</h2>
                  <p className="text-gray-500 mb-6">这是一个智能化的SQL生成工具，可以帮助你通过自然语言生成SQL查询语句。</p>
                  <button
                    onClick={handleNewConversation}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    新建对话
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* 输入区域 */}
          {currentConversation && (
            <div className="p-4 border-t border-gray-800">
              <div className="relative">
                <textarea
                  className="w-full p-3 pr-12 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="输入您的问题或需要的SQL查询..."
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading}
                />
                <button
                  className={`absolute right-3 bottom-3 text-white p-1 rounded-full ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                  onClick={handleSendMessage}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* 当前模型提示和模型切换 */}
              <div className="mt-2 flex flex-col sm:flex-row justify-between items-center px-2">
                <div className="flex items-center">
                  <div className="text-xs text-gray-500 mr-4">
                    当前使用: {currentModel === 't5' ? 'T5模型' : 'DeepSeek'} | 
                    输入问题或需求，系统将自动生成SQL查询语句
                  </div>
                  
                  {/* 前往数据可视化按钮 */}
                  <button
                    onClick={handleVisualizeClick}
                    className="text-xs bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-md px-3 py-1 transition-colors"
                    title="使用最新的SQL查询进行数据可视化"
                  >
                    前往数据可视化
                  </button>
                </div>
                
                <div className="mt-2 sm:mt-0 flex items-center">
                  <span className="text-xs text-gray-500 mr-2">切换模型:</span>
                  <select 
                    className="bg-gray-700 text-white text-sm rounded-md border border-gray-600 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={currentModel}
                    onChange={(e) => handleModelSwitch(e.target.value as 't5' | 'deepseek')}
                    disabled={isLoading}
                  >
                    <option value="t5">T5模型 (本地)</option>
                    <option value="deepseek">DeepSeek (API)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

// 导出组件
export default AIChat;
