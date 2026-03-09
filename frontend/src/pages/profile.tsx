import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 用户信息表单
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    avatar: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // 加载用户数据
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        fullName: user.fullName || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user]);
  
  // 表单状态
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // 清除该字段的错误
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // 验证表单
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // 验证用户名
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    }
    
    // 验证邮箱
    if (!formData.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    // 如果要修改密码，验证密码
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = '请输入当前密码';
      }
      
      if (formData.newPassword.length < 6) {
        newErrors.newPassword = '新密码至少需要6个字符';
      }
      
      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = '两次输入的密码不一致';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsUpdating(true);
    
    // 准备要提交的数据
    const updateData: {
      username: string;
      email: string;
      fullName?: string;
      avatar?: string;
      password?: string;
      current_password?: string;
    } = {
      username: formData.username,
      email: formData.email,
      fullName: formData.fullName,
    };
    
    // 如果有头像变更，添加到提交数据中
    if (formData.avatar && formData.avatar !== user?.avatar) {
      updateData.avatar = formData.avatar;
    }
    
    // 如果要更改密码
    if (formData.newPassword && formData.currentPassword) {
      updateData.password = formData.newPassword;
      updateData.current_password = formData.currentPassword;
    }
    
    try {
      // 调用后端接口更新用户信息
      const response = await axios.put('http://localhost:8080/api/v1/auth/update', updateData);
      
      if (response.status === 200) {
        // 更新前端用户状态
        updateUser({
          ...user,
          ...response.data
        });
        
        setUpdateSuccess(true);
        
        // 清除密码字段
        setFormData((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        
        // 3秒后清除成功消息
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
      // 处理错误情况
      if (axios.isAxiosError(error) && error.response) {
        // 设置错误信息
        if (error.response.status === 401) {
          setErrors({ currentPassword: '当前密码错误' });
        } else if (error.response.data && error.response.data.detail) {
          setErrors({ general: error.response.data.detail });
        } else {
          setErrors({ general: '更新信息失败，请稍后重试' });
        }
      } else {
        setErrors({ general: '网络错误，请检查您的连接' });
      }
    } finally {
      setIsUpdating(false);
    }
  };
  
  // 处理头像点击
  const handleAvatarClick = () => {
    // 点击头像时自动触发文件选择对话框
    fileInputRef.current?.click();
  };

  // 处理头像上传
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 清除之前的错误
    setErrors((prev) => {
      const newErrors = {...prev};
      delete newErrors.avatar;
      delete newErrors.general;
      return newErrors;
    });
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        avatar: '请上传图片文件',
      }));
      return;
    }
    
    // 检查文件大小 (限制为2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        avatar: '图片大小不能超过2MB',
      }));
      return;
    }
    
    // 显示上传中的状态
    setIsUpdating(true);
    
    // 转换文件为Base64字符串，以便发送给后端
    const reader = new FileReader();
    reader.onload = async () => {
      const avatarData = reader.result as string;
      setFormData((prev) => ({
        ...prev,
        avatar: avatarData,
      }));
      
      try {
        // 获取token
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('未登录状态');
        }
        
        // 调用后端接口上传头像
        const response = await axios.post('http://localhost:8080/api/v1/auth/upload-avatar', 
          { avatar: avatarData },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.status === 200) {
          // 更新前端用户状态
          updateUser({
            ...user,
            avatar: response.data.avatar,
          });
          
          // 显示成功消息
          setUpdateSuccess(true);
          setTimeout(() => {
            setUpdateSuccess(false);
          }, 3000);
        }
      } catch (error) {
        console.error('上传头像失败:', error);
        // 处理错误情况
        if (axios.isAxiosError(error) && error.response) {
          // 设置错误信息
          if (error.response.data && error.response.data.detail) {
            setErrors({ avatar: error.response.data.detail });
          } else {
            setErrors({ avatar: '上传头像失败，请稍后重试' });
          }
        } else {
          setErrors({ avatar: '网络错误，请检查您的连接' });
        }
      } finally {
        setIsUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // 处理用户注销
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const openDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };
  
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };
  
  const handleAccountDeletion = async () => {
    if (!user || !user.id) return;
    
    try {
      setIsDeleting(true);
      
      // 获取token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未登录状态');
      }
      
      // 调用后端接口删除账户
      await axios.delete(`http://localhost:8080/api/v1/auth/delete-account`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 注销并跳转到登录页
      logout();
      router.push('/login');
    } catch (error) {
      console.error('注销账户失败:', error);
      // 处理错误情况
      if (axios.isAxiosError(error) && error.response) {
        // 设置错误信息
        if (error.response.data && error.response.data.detail) {
          setErrors({ general: error.response.data.detail });
        } else {
          setErrors({ general: '注销账户失败，请稍后重试' });
        }
      } else {
        setErrors({ general: '网络错误，请检查您的连接' });
      }
    } finally {
      setIsDeleting(false);
      closeDeleteModal();
    }
  };

  return (
    <DashboardLayout title="个人资料">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 个人资料 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2 card-space"
        >
          <h2 className="text-xl font-semibold text-white mb-4">个人资料</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="用户名"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                fullWidth
              />
              
              <Input
                label="电子邮箱"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                fullWidth
              />
            </div>
            
            <div className="mb-4">
              <Input
                label="全名"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                fullWidth
              />
            </div>
            
            <h3 className="text-lg font-medium text-white mt-6 mb-4">修改密码</h3>
            
            <div className="mb-4">
              <Input
                label="当前密码"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleChange}
                error={errors.currentPassword}
                fullWidth
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="新密码"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
                error={errors.newPassword}
                helperText="留空表示不修改密码"
                fullWidth
              />
              
              <Input
                label="确认新密码"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                fullWidth
              />
            </div>
            
            <div className="mt-6 flex justify-end">
              {errors.general && (
                <p className="text-red-500 text-sm mr-auto self-center">{errors.general}</p>
              )}
              <Button
                type="submit"
                isLoading={isUpdating}
              >
                {isUpdating ? '更新中...' : updateSuccess ? '更新成功！' : '保存更改'}
              </Button>
            </div>
          </form>
        </motion.div>
        
        {/* 头像和账户信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card-space"
        >
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <div 
                className="w-32 h-32 rounded-full overflow-hidden bg-space-dark mx-auto mb-4 cursor-pointer"
                onClick={handleAvatarClick} // 点击整个头像区域触发上传
              >
                {formData.avatar ? (
                  <img
                    src={formData.avatar}
                    alt="用户头像"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-space-accent/20 text-space-accent text-4xl font-bold">
                    {formData.username ? formData.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-space-accent text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </label>
              
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                ref={fileInputRef}
              />
            </div>
            
            {errors.avatar && (
              <p className="text-red-500 text-xs mt-1">{errors.avatar}</p>
            )}
            
            <h3 className="text-xl font-medium text-white">
              {formData.fullName || formData.username}
            </h3>
            <p className="text-gray-400">{formData.email}</p>
          </div>
          
          <div className="border-t border-gray-700 pt-4">
            <div className="mb-4">
              <p className="text-gray-400 text-sm">账户类型</p>
              <p className="text-white font-medium">
                {user?.role === 'admin' ? '管理员' : '标准用户'}
              </p>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm">注册时间</p>
              <p className="text-white font-medium">2025年3月1日</p>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm">上次登录</p>
              <p className="text-white font-medium">2025年3月5日 13:45</p>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-4 mt-4">
            <Button
              variant="outline"
              className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={openDeleteModal}
            >
              注销账户
            </Button>
          </div>
          
          {/* 注销账户确认对话框 */}
          {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-space-dark border border-gray-700 rounded-lg p-6 w-full max-w-md"
              >
                <h3 className="text-xl font-medium text-white mb-4">确认注销账户</h3>
                <p className="text-gray-300 mb-6">
                  注意：这将<span className="text-red-500 font-bold">永久删除</span>您的账户和所有相关数据，包括对话历史、设置与偏好。此操作无法撤销。
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    请输入“我确认注销账户”以确认
                  </label>
                  <input
                    type="text"
                    className="bg-space-dark/50 border border-gray-700 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                    placeholder="我确认注销账户"
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={closeDeleteModal}
                  >
                    取消
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={isDeleting}
                    onClick={handleAccountDeletion}
                  >
                    {isDeleting ? '正在注销...' : '确认注销'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
