import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 如果用户已登录，重定向到仪表板
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // 星星背景动画
  const starVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <div className="min-h-screen bg-space-dark flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* 星星背景 */}
      <div className="stars-container">
        <div id="stars"></div>
        <div id="stars2"></div>
        <div id="stars3"></div>
      </div>

      {/* 主内容 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 max-w-4xl w-full text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl md:text-6xl font-bold text-white mb-4"
        >
          <span className="text-space-accent">Star</span>Data
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-gray-300 mb-8"
        >
          智能数据分析对话平台
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-gray-400 mb-8 max-w-2xl mx-auto"
        >
          通过自然语言与您的数据对话，获取深度洞察。StarData 利用先进的 AI
          技术，将您的问题转化为精确的数据查询，并提供直观的可视化结果。
        </motion.p>

        {/* 功能特点 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="bg-space-dark/50 p-6 rounded-lg border border-space-accent/20 backdrop-blur-sm">
            <div className="bg-space-accent/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-space-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">自然语言查询</h3>
            <p className="text-gray-400">
              使用日常语言提问，无需编写复杂的 SQL 查询语句，系统自动转换为精确的数据库查询。
            </p>
          </div>

          <div className="bg-space-dark/50 p-6 rounded-lg border border-space-accent/20 backdrop-blur-sm">
            <div className="bg-space-accent/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-space-accent"
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
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">智能数据可视化</h3>
            <p className="text-gray-400">
              自动选择最合适的图表类型展示您的数据，包括柱状图、折线图、饼图等，让数据更直观。
            </p>
          </div>

          <div className="bg-space-dark/50 p-6 rounded-lg border border-space-accent/20 backdrop-blur-sm">
            <div className="bg-space-accent/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-space-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">对话历史管理</h3>
            <p className="text-gray-400">
              保存所有对话历史，方便随时查看和导出，持续积累您的数据分析成果。
            </p>
          </div>
        </motion.div>

        {/* 按钮 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <Link href="/login" className="btn-space-primary px-8 py-3 text-lg">
            登录
          </Link>
          <Link href="/register" className="btn-space px-8 py-3 text-lg">
            注册
          </Link>
        </motion.div>
      </motion.div>

      {/* 页脚 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute bottom-4 text-gray-500 text-sm z-10"
      >
        © 2025 StarData 智能数据分析平台
      </motion.div>
    </div>
  );
}
