import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import axios from 'axios';

type ThemeType = 'dark' | 'light' | 'space';
type ContrastType = 'low' | 'normal' | 'high';
type FontSizeType = 'small' | 'medium' | 'large';

interface ThemeContextType {
  theme: ThemeType;
  contrast: ContrastType;
  fontSize: FontSizeType;
  setTheme: (theme: ThemeType) => void;
  setContrast: (contrast: ContrastType) => void;
  setFontSize: (fontSize: FontSizeType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  contrast: 'normal',
  fontSize: 'medium',
  setTheme: () => {},
  setContrast: () => {},
  setFontSize: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [contrast, setContrast] = useState<ContrastType>('normal');
  const [fontSize, setFontSize] = useState<FontSizeType>('medium');
  
  useEffect(() => {
    // 初始化时从localStorage获取主题设置
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    const savedContrast = localStorage.getItem('contrast') as ContrastType;
    const savedFontSize = localStorage.getItem('fontSize') as FontSizeType;
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    if (savedContrast) {
      setContrast(savedContrast);
      document.documentElement.setAttribute('data-contrast', savedContrast);
    }
    
    if (savedFontSize) {
      setFontSize(savedFontSize);
      document.documentElement.setAttribute('data-font-size', savedFontSize);
    }
    
    // 尝试从API获取用户保存的主题设置
    const fetchUserTheme = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get('http://localhost:8080/api/v1/settings/user-settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && response.data.settings && response.data.settings.interface && response.data.settings.interface.theme) {
          // 加载用户设置
          if (response.data.settings.interface) {
            const userInterface = response.data.settings.interface;
            
            if (userInterface.theme) {
              const userTheme = userInterface.theme;
              setTheme(userTheme);
              document.documentElement.setAttribute('data-theme', userTheme);
              localStorage.setItem('theme', userTheme);
            }
            
            if (userInterface.contrast) {
              const userContrast = userInterface.contrast;
              setContrast(userContrast);
              document.documentElement.setAttribute('data-contrast', userContrast);
              localStorage.setItem('contrast', userContrast);
            }
            
            if (userInterface.fontSize) {
              const userFontSize = userInterface.fontSize;
              setFontSize(userFontSize);
              document.documentElement.setAttribute('data-font-size', userFontSize);
              localStorage.setItem('fontSize', userFontSize);
            }
          }
        }
      } catch (error) {
        console.error('获取用户主题设置失败:', error);
      }
    };
    
    fetchUserTheme();
  }, []);
  
  const updateTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    // 这里不需要立即保存到服务器，用户会在设置页面点击保存按钮时一起保存
  };
  
  const updateContrast = (newContrast: ContrastType) => {
    setContrast(newContrast);
    localStorage.setItem('contrast', newContrast);
    document.documentElement.setAttribute('data-contrast', newContrast);
  };
  
  const updateFontSize = (newFontSize: FontSizeType) => {
    setFontSize(newFontSize);
    localStorage.setItem('fontSize', newFontSize);
    document.documentElement.setAttribute('data-font-size', newFontSize);
  };
  
  return (
    <ThemeContext.Provider value={{
      theme,
      contrast,
      fontSize,
      setTheme: updateTheme,
      setContrast: updateContrast,
      setFontSize: updateFontSize
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
