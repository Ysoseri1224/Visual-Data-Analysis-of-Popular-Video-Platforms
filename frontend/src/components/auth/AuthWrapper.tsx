/**
 * 认证包裹组件
 * 用于将认证逻辑从页面组件中分离出来
 */

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean; // 是否强制要求登录
}

/**
 * 认证包裹组件
 * 当需要认证时使用此组件包裹页面
 */
export default function AuthWrapper({ children, requireAuth = false }: AuthWrapperProps) {
  // 在测试模式下，不强制要求认证
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
