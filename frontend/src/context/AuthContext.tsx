import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

// 定义API基础URL常量
const API_BASE_URL = 'http://localhost:8080/api/v1';

// 定义用户类型
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName?: string;
  avatar?: string;
  created_at?: string;
  last_login?: string;
}

// 定义认证上下文类型
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsAdmin: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  error: string | null;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  loginAsAdmin: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
  error: null,
});

// 认证提供者组件
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 检查用户是否已登录
  useEffect(() => {
    const checkUserLoggedIn = async () => {
      console.log('检查用户登录状态...');
      try {
        const token = localStorage.getItem('token');
        console.log('localStorage中的token状态:', token ? '存在' : '不存在');
        
        if (token) {
          console.log('token前20个字符:', token.substring(0, 20));
          // 设置默认请求头
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('已设置Authorization请求头');
          
          // 获取当前用户信息
          console.log('发送获取用户信息请求...');
          try {
            const res = await axios.get(`${API_BASE_URL}/auth/me`, {
              timeout: 10000 // 10秒超时
            });
            
            console.log('获取用户信息成功:', res.data);
            if (res.data) {
              setUser(res.data);
              console.log('用户状态已更新');
            }
          } catch (apiError: any) {
            console.error('API请求失败:', apiError.message);
            console.error('错误详情:', apiError.response?.data || '无响应数据');
            throw apiError;
          }
        } else {
          console.log('未找到token，用户未登录');
        }
      } catch (error: any) {
        console.error('检查登录状态时出错:', error);
        console.error('清除token和Authorization头');
        localStorage.removeItem('token');
        axios.defaults.headers.common['Authorization'] = '';
      }
      
      console.log('设置loading=false');
      setLoading(false);
    };

    checkUserLoggedIn();
  }, []);

  // 登录函数
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`尝试登录: ${email}`);
      console.log('浏览器localStorage状态:', localStorage.getItem('token') ? '有token' : '无token');
      
      // 使用URLSearchParams代替FormData，以确保正确的Content-Type
      const params = new URLSearchParams();
      params.append('username', email); // OAuth2使用username字段，而不是email
      params.append('password', password);
      
      console.log('发送登录请求...');
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/login`, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // 10秒超时
        });
      if (res.data.access_token) {
        console.log(`获得访问令牌: ${res.data.access_token.substring(0, 20)}...`);
        localStorage.setItem('token', res.data.access_token);
        console.log('token已保存到localStorage');
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
        console.log('Authorization头已设置');
        
        // 获取用户信息
        console.log('获取用户信息...');
        try {
          console.log('发送获取用户信息请求...');
          const userRes = await axios.get(`${API_BASE_URL}/auth/me`, {
            timeout: 10000, // 10秒超时
            headers: {
              'Authorization': `Bearer ${res.data.access_token}`
            }
          });
          console.log('用户信息响应状态:', userRes.status);
          console.log('------------用户信息:', userRes.data);
          setUser(userRes.data);
          
          console.log('跳转到仪表盘...');
          router.push('/dashboard');
        } catch (userError: any) {
          console.error('获取用户信息失败:', userError);
          console.error('错误详情:', userError.response?.data || userError.message);
          setError(`登录成功但无法获取用户信息: ${userError.message}`);
        }
      } else {
        console.error('响应中没有访问令牌');
        setError('登录响应中没有访问令牌');
      }
      } catch (axiosError: any) {
        console.error('登录请求失败:', axiosError);
        console.error('错误状态:', axiosError.response?.status);
        console.error('错误详情:', axiosError.response?.data || axiosError.message);
        throw axiosError;
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      console.error('错误响应:', error.response?.data);
      setError(error.response?.data?.detail || `登录失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 注册函数
  const register = async (username: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await axios.post(`${API_BASE_URL}/auth/register`, {
        username,
        email,
        password,
      });
      
      if (res.data) {
        // 注册成功后自动登录
        await login(email, password);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || '注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 登出函数
  const logout = () => {
    console.log('用户登出');
    localStorage.removeItem('token');
    axios.defaults.headers.common['Authorization'] = '';
    setUser(null);
    router.push('/login');
  };
  
  // 更新用户信息
  const updateUser = (userData: Partial<User>) => {
    console.log('更新用户信息:', userData);
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  // 管理员登录函数
  const loginAsAdmin = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`尝试管理员登录: ${email}`);
      
      // 使用URLSearchParams代替FormData，以确保正确的Content-Type
      const params = new URLSearchParams();
      params.append('username', email); // OAuth2使用username字段，而不是email
      params.append('password', password);
      params.append('role', 'admin'); // 添加角色参数表明这是管理员登录
      
      console.log('发送管理员登录请求...');
      
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/admin/login`, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // 10秒超时
        });
        
        console.log('管理员登录响应状态:', res.status);
        console.log('管理员登录响应:', res.data);
      
        if (res.data.access_token) {
          console.log(`获得访问令牌: ${res.data.access_token.substring(0, 20)}...`);
          localStorage.setItem('token', res.data.access_token);
          console.log('token已保存到localStorage');
          axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
          console.log('Authorization头已设置');
          
          // 获取用户信息
          console.log('获取管理员信息...');
          try {
            console.log('发送获取管理员信息请求...');
            const userRes = await axios.get(`${API_BASE_URL}/auth/admin/me`, {
              timeout: 10000, // 10秒超时
              headers: {
                'Authorization': `Bearer ${res.data.access_token}`
              }
            });
            console.log('管理员信息响应状态:', userRes.status);
            console.log('管理员信息:', userRes.data);
            setUser(userRes.data);
            
            console.log('跳转到管理控制台...');
            router.push('/admin/dashboard');
          } catch (userError: any) {
            console.error('获取管理员信息失败:', userError);
            console.error('错误详情:', userError.response?.data || userError.message);
            setError(`登录成功但无法获取管理员信息: ${userError.message}`);
          }
        } else {
          console.error('响应中没有访问令牌');
          setError('登录响应中没有访问令牌');
        }
      } catch (axiosError: any) {
        console.error('管理员登录请求失败:', axiosError);
        console.error('错误状态:', axiosError.response?.status);
        console.error('错误详情:', axiosError.response?.data || axiosError.message);
        throw axiosError;
      }
    } catch (error: any) {
      console.error('管理员登录失败:', error);
      console.error('错误响应:', error.response?.data);
      setError(error.response?.data?.detail || `管理员登录失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsAdmin, register, logout, updateUser, error }}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义钩子，用于在组件中访问认证上下文
export const useAuth = () => useContext(AuthContext);
