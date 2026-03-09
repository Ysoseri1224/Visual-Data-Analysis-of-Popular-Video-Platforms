import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { format } from 'date-fns';

// 定义类型
interface MemorySearchResult {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  matched_message: string;
  matched_role: string;
}

export default function MemorySearch() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('请输入搜索关键词');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 获取用户认证令牌
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未登录或认证令牌已过期，请重新登录');
        setIsLoading(false);
        return;
      }

      // 目前使用模拟数据，实际项目中应该从后端API获取
      // 实际实现时，可以创建一个 /api/v1/memory/search 接口
      setTimeout(() => {
        const mockResults: MemorySearchResult[] = [
          {
            id: '1',
            title: '聊天记录示例1',
            created_at: new Date(2025, 4, 15).toISOString(),
            updated_at: new Date(2025, 4, 15).toISOString(),
            message_count: 8,
            matched_message: `这是一段包含关键词"${searchTerm}"的消息示例`,
            matched_role: 'user'
          },
          {
            id: '2',
            title: '技术讨论',
            created_at: new Date(2025, 4, 14).toISOString(),
            updated_at: new Date(2025, 4, 14).toISOString(),
            message_count: 12,
            matched_message: `另一段包含"${searchTerm}"的对话内容示例`,
            matched_role: 'system'
          },
          {
            id: '3',
            title: '项目规划',
            created_at: new Date(2025, 4, 10).toISOString(),
            updated_at: new Date(2025, 4, 13).toISOString(),
            message_count: 15,
            matched_message: `这是系统回复中包含"${searchTerm}"的内容`,
            matched_role: 'system'
          }
        ];

        setSearchResults(mockResults);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('搜索记忆库失败:', error);
      setError('搜索记忆库失败，请检查网络连接');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  return (
    <DashboardLayout title="记忆库搜索">
      <div className="flex flex-col h-full min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">记忆库搜索</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => router.push('/memory/manage')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
            >
              记忆库管理
            </button>
            <button 
              onClick={() => router.push('/data')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              返回数据面板
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="输入关键词搜索记忆库..."
              className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg transition-colors ${
                isLoading 
                  ? 'bg-gray-600' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                  搜索中...
                </div>
              ) : (
                '搜索'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* 搜索结果 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl mb-4">搜索结果</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchTerm ? (
                <p>未找到匹配的记忆</p>
              ) : (
                <p>请输入关键词开始搜索</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors"
                  onClick={() => router.push(`/memory/manage?view=${result.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-blue-400">{result.title || '无标题对话'}</h3>
                    <span className="text-xs text-gray-400">
                      {formatDate(result.updated_at)}
                    </span>
                  </div>
                  
                  <div className={`p-3 rounded-lg mb-3 ${
                    result.matched_role === 'user' 
                      ? 'bg-blue-900/30 border border-blue-900' 
                      : 'bg-purple-900/30 border border-purple-900'
                  }`}>
                    <div className="mb-1">
                      <span className="text-xs font-medium text-gray-300">
                        {result.matched_role === 'user' ? '用户' : '系统'}
                      </span>
                    </div>
                    <p className="text-gray-200 text-sm">{result.matched_message}</p>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>消息数: {result.message_count}</span>
                    <button 
                      className="px-3 py-1 bg-blue-600/50 hover:bg-blue-600 rounded text-xs transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/conversations/AIchat?id=${result.id}`);
                      }}
                    >
                      继续对话
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
