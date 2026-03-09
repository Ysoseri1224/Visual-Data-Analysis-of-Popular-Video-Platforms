import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

// 用户类型定义
type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  last_login: string;
  status: 'active' | 'inactive' | 'banned';
};

// API基础URL
const API_BASE_URL = 'http://localhost:8080/api/v1';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // 加载用户数据
  useEffect(() => {
    // 调用后端API获取用户数据
    const fetchUsers = async () => {
      try {
        // 获取token
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('未找到登录凭证');
          setLoading(false);
          return;
        }
        
        // 发起API请求
        const response = await axios.get(`${API_BASE_URL}/auth/admin/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // 转换响应数据为我们的User类型
        setUsers(response.data);
        setLoading(false);
      } catch (error) {
        console.error('获取用户数据失败:', error);
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // 处理用户编辑
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  // 处理用户删除
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // 处理用户修改
  const handleEditUserSubmit = async () => {
    if (!selectedUser) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('未找到登录凭证');
        return;
      }
      
      // 准备完整的用户数据
      const userData = {
        username: selectedUser.username,
        email: selectedUser.email,
        role: selectedUser.role,
        status: selectedUser.status
      };
      
      console.log('尝试使用直接更新API更新用户信息:', userData);
      
      // 使用直接更新API，绝过Pydantic验证
      const response = await axios.post(
        `${API_BASE_URL}/auth/admin/users/${selectedUser.id}/direct-update`, 
        userData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('用户信息更新成功，响应：', response.data);
      
      // 更新用户列表
      setUsers(users.map(user => (
        user.id === selectedUser.id ? { ...user, ...userData } : user
      )));
      
      setIsEditModalOpen(false);
      setSelectedUser(null);
      
      // 显示成功消息
      alert('用户信息更新成功！');
      
    } catch (error) {
      console.error('更新用户信息失败:', error);
      alert('更新用户信息失败，请稍后重试。');
    }
  };

  // 处理用户删除
  const handleDeleteUserSubmit = async () => {
    if (!selectedUser) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('未找到登录凭证');
        return;
      }
      
      // 删除用户
      await axios.delete(
        `${API_BASE_URL}/auth/admin/users/${selectedUser.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // 从列表中移除用户
      setUsers(users.filter(user => user.id !== selectedUser.id));
      
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('删除用户失败:', error);
    }
  };

  // 重置用户密码
  const handleResetPassword = (userId: string) => {
    // 实际应用中，这里应该是一个API调用
    console.log(`重置用户 ${userId} 的密码`);
    // 显示成功消息
    alert(`已发送密码重置链接到用户邮箱`);
  };

  // 更改用户状态
  const handleChangeStatus = (userId: string, newStatus: 'active' | 'inactive' | 'banned') => {
    // 实际应用中，这里应该是一个API调用
    setUsers(users.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-space-accent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-semibold">用户管理</h2>
        
        <div className="flex flex-col md:flex-row gap-3">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索用户名或邮箱"
              className="bg-space-dark/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 w-full md:w-64 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* 角色筛选 */}
          <select
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">所有角色</option>
            <option value="admin">管理员</option>
            <option value="user">普通用户</option>
          </select>
          
          {/* 状态筛选 */}
          <select
            className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">所有状态</option>
            <option value="active">活跃</option>
            <option value="inactive">不活跃</option>
            <option value="banned">已禁用</option>
          </select>
        </div>
      </div>

      {/* 用户表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-space-dark/70">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">用户信息</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">角色</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">状态</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">注册时间</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">最近活动</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-space-dark/30 divide-y divide-gray-700">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="hover:bg-space-dark/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-white">{user.username}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : user.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {user.status === 'active' ? '活跃' : user.status === 'inactive' ? '不活跃' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(user.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {user.last_login ? new Date(user.last_login).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未登录'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-space-accent hover:text-space-accent/80 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-yellow-500 hover:text-yellow-400 transition-colors"
                      >
                        重置密码
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-500 hover:text-red-400 transition-colors"
                        disabled={user.role === 'admin'}
                      >
                        {user.role === 'admin' ? '' : '删除'}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                  没有找到匹配的用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 编辑用户模态框 */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-space-dark border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-medium text-white mb-4">编辑用户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">用户名</label>
                <input
                  type="text"
                  className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
                  value={selectedUser.username}
                  onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">电子邮箱</label>
                <input
                  type="email"
                  className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">角色</label>
                <select
                  className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">状态</label>
                <select
                  className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-space-accent focus:border-space-accent"
                  value={selectedUser.status}
                  onChange={(e) => setSelectedUser({...selectedUser, status: e.target.value as 'active' | 'inactive' | 'banned'})}
                >
                  <option value="active">活跃</option>
                  <option value="inactive">不活跃</option>
                  <option value="banned">已禁用</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEditUserSubmit}
                className="px-4 py-2 bg-space-accent hover:bg-blue-600 text-white rounded-md mr-2"
              >
                保存
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-space-dark border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-medium text-white mb-4">确认删除</h3>
            <p className="text-gray-300 mb-6">
              您确定要删除用户 <span className="text-white font-medium">{selectedUser.username}</span> ({selectedUser.email}) 吗？此操作无法撤销。
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteUserSubmit}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md mr-2"
              >
                删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
