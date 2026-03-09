import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

// 组件导入
import UserManagement from '@/components/admin/UserManagement';
import SystemMonitoring from '@/components/admin/SystemMonitoring';
import LogManagement from '@/components/admin/LogManagement';

export default function AdminDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');

  // 如果用户未登录或不是管理员，重定向到管理员登录页面
  React.useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-space-accent"></div>
      </div>
    );
  }

  // 处理登出
  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  // 渲染标签页内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'monitoring':
        return <SystemMonitoring />;
      case 'logs':
        return <LogManagement />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-space-dark text-white">
      {/* 顶部导航栏 */}
      <nav className="bg-space-dark/80 backdrop-blur-sm border-b border-space-accent/20 px-4 py-3 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-space-accent text-xl font-bold">StarData</span>
            <span className="text-sm bg-space-accent/20 text-space-accent px-2 py-0.5 rounded">
              管理控制台
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-300">
              管理员: <span className="text-white">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        {/* 页面标题 */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold mb-6 text-white"
        >
          系统管理
        </motion.h1>

        {/* 标签页导航 */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'users' ? 'text-space-accent border-b-2 border-space-accent' : 'text-gray-400 hover:text-white'}`}
            >
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'monitoring' ? 'text-space-accent border-b-2 border-space-accent' : 'text-gray-400 hover:text-white'}`}
            >
              系统监控
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'logs' ? 'text-space-accent border-b-2 border-space-accent' : 'text-gray-400 hover:text-white'}`}
            >
              日志管理
            </button>
          </div>
        </div>

        {/* 标签页内容 */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  );
}
