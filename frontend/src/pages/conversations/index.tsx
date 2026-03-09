/**
 * 对话列表页面
 * 这是对话功能的入口页面
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ConversationsPage: React.FC = () => {
  const router = useRouter();

  // 组件加载时自动重定向到AI聊天页面
  useEffect(() => {
    router.push('/conversations/AIchat');
  }, [router]);

  return (
    <DashboardLayout title="对话">
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-space-accent"></div>
        <p className="ml-4 text-gray-300">正在跳转到对话界面...</p>
      </div>
    </DashboardLayout>
  );
};

export default ConversationsPage;
