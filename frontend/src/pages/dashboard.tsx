import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalMessages: 0, // 原来的activeConversations改为totalMessages(总会话数)
    totalQueries: 0,
    successfulQueries: 0,
    successfulQueriesRate: 0, // 新增成功查询率
  });

  // 从API获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 从新创建的API端点获取数据
        const response = await fetch('/api/statistics');
        if (!response.ok) {
          throw new Error(`获取统计数据失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 设置统计数据
        setStats({
          totalConversations: data.totalConversations,
          totalMessages: data.totalMessages, // 总会话数
          totalQueries: data.totalQueries,
          successfulQueries: data.successfulQueries,
          successfulQueriesRate: data.successfulQueriesRate,
        });
      } catch (error) {
        console.error('获取统计数据失败:', error);
        // 设置默认值
        setStats({
          totalConversations: 0,
          totalMessages: 0,
          totalQueries: 0,
          successfulQueries: 0,
          successfulQueriesRate: 0,
        });
      }
    };
    
    fetchStats();
    
    // 设置定时器，每60秒更新一次数据
    const intervalId = setInterval(fetchStats, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // 最近的对话
  interface RecentConversation {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }

  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  
  // 从数据库获取最近对话
  useEffect(() => {
    const fetchRecentConversations = async () => {
      try {
        setIsLoadingConversations(true);
        // 从 API 获取最近对话
        const response = await fetch('/api/recentConversations?limit=3');
        
        if (!response.ok) {
          throw new Error(`获取对话失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
          // 处理获取到的对话数据
          const processedConversations = result.data.map((conv: any) => ({
            id: conv.id,
            title: conv.title || '新对话',
            updatedAt: conv.updatedAt,
            messageCount: conv.messageCount || 0
          }));
          
          setRecentConversations(processedConversations);
        } else {
          console.warn('获取对话数据格式异常:', result);
          setRecentConversations([]);
        }
      } catch (error) {
        console.error('获取最近对话失败:', error);
        setRecentConversations([]);
      } finally {
        setIsLoadingConversations(false);
      }
    };
    
    fetchRecentConversations();
    
    // 每 60 秒更新一次数据
    const intervalId = setInterval(fetchRecentConversations, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else if (diffMins > 0) {
      return `${diffMins}分钟前`;
    } else {
      return '刚刚';
    }
  };

  return (
    <DashboardLayout title="仪表板">
      {/* 欢迎信息 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card-space mb-8"
      >
        <h2 className="text-xl font-semibold text-space-accent mb-2">
          欢迎回来，{user?.username || '用户'}
        </h2>
        <p className="text-gray-300">
          使用StarData智能数据分析平台，通过自然语言与您的数据对话，获取洞察力。
        </p>
      </motion.div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card-space"
        >
          <h3 className="text-gray-400 text-sm font-medium mb-2">总对话数</h3>
          <p className="text-3xl font-bold text-white">{stats.totalConversations}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="card-space"
        >
          <h3 className="text-gray-400 text-sm font-medium mb-2">总会话数</h3>
          <p className="text-3xl font-bold text-white">{stats.totalMessages}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="card-space"
        >
          <h3 className="text-gray-400 text-sm font-medium mb-2">查询总数</h3>
          <p className="text-3xl font-bold text-white">{stats.totalQueries}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="card-space"
        >
          <h3 className="text-gray-400 text-sm font-medium mb-2">已完成查询数</h3>
          <p className="text-3xl font-bold text-white">{stats.successfulQueries}</p>
          <div className="mt-2 h-2 bg-space-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-space-accent"
              style={{
                width: `${stats.successfulQueriesRate * 100}%`,
              }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            成功率: {Math.round(stats.successfulQueriesRate * 100)}%
          </p>
        </motion.div>
      </div>

      {/* 快速操作 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="card-space mb-8"
      >
        <h3 className="text-lg font-semibold text-white mb-4">快速操作</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/conversations/AIchat"
            className="btn-space flex items-center justify-center py-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            新建对话
          </Link>

          <Link
            href="/data/import"
            className="btn-space flex items-center justify-center py-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            导入数据
          </Link>

          <Link
            href="/data/view"
            className="btn-space flex items-center justify-center py-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            查看数据
          </Link>

          <Link
            href="/settings"
            className="btn-space flex items-center justify-center py-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            系统设置
          </Link>
        </div>
      </motion.div>

      {/* 最近的对话 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="card-space"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">最近的对话</h3>
          <Link
            href="/conversations"
            className="text-space-accent hover:underline text-sm"
          >
            查看全部
          </Link>
        </div>

        {isLoadingConversations ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : recentConversations.length > 0 ? (
          <div className="space-y-4">
            {recentConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/AIchat?id=${conversation.id}`}
                className="block"
              >
                <div className="bg-space-dark/50 hover:bg-space-dark p-4 rounded-lg transition-colors duration-200">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-white">{conversation.title}</h4>
                    <span className="text-xs text-gray-400">
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{conversation.messageCount} 条消息</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-space-dark/50 p-6 rounded-lg text-center">
            <p className="text-gray-400">暂无对话记录</p>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
