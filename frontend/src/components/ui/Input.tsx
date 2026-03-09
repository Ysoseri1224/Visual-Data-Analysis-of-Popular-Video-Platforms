import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    // 基础样式
    const baseInputStyles =
      'bg-space-dark/50 border border-space-accent/30 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-space-accent focus:border-space-accent transition-all';
    
    // 错误样式
    const errorInputStyles = error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : '';
    
    // 图标样式
    const iconInputStyles = leftIcon ? 'pl-10' : '';
    
    // 宽度样式
    const widthStyles = fullWidth ? 'w-full' : '';
    
    // 组合样式
    const inputStyles = `
      ${baseInputStyles} 
      ${errorInputStyles} 
      ${iconInputStyles} 
      ${widthStyles} 
      ${className}
    `;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} mb-4`}>
        {label && (
          <label className="block text-gray-300 text-sm font-medium mb-2">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input ref={ref} className={inputStyles} {...props} />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-400">{helperText}</p>
        )}
        
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
