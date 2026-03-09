#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
修复文件中的Unicode编码问题，将形如u4e2du6587的编码转换为实际的中文字符
遍历项目目录下所有前端文件并执行修改
'''

import os
import re
import codecs
import sys
import traceback

# 前端文件的扩展名列表
FRONTEND_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.html', '.css']

# Unicode编码正则表达式模式
# 匹配形如 u4e2d u6587 的Unicode编码序列
UNICODE_PATTERN = r'u([0-9a-f]{4})'

def decode_unicode_escape(match):
    '''
    将匹配到的Unicode编码转换为对应的中文字符
    '''
    hex_str = match.group(1)
    try:
        # 将十六进制字符串转换为整数，然后转换为对应的Unicode字符
        return chr(int(hex_str, 16))
    except Exception as e:
        # 如果转换失败，返回原始匹配并输出错误
        print(f'转换错误: {hex_str} - {str(e)}')
        return match.group(0)

def process_file(file_path):
    '''
    处理单个文件，替换Unicode编码为中文字符
    返回值: 如果文件被修改则返回True，否则返回False
    '''
    print(f'处理文件: {file_path}')
    
    try:
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否包含Unicode编码
        if re.search(UNICODE_PATTERN, content):
            # 替换Unicode编码为中文字符
            modified_content = re.sub(UNICODE_PATTERN, decode_unicode_escape, content)
            
            # 写回文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            
            # 输出替换前后的差异
            count = len(re.findall(UNICODE_PATTERN, content))
            print(f'  已替换Unicode编码为中文字符，共替换了 {count} 个Unicode编码')
            return True
        else:
            print(f'  未发现Unicode编码')
            return False
    
    except Exception as e:
        print(f'  处理文件时出错: {str(e)}')
        return False

def process_directory(directory_path):
    '''
    处理目录下的所有前端文件
    '''
    print(f'处理目录: {directory_path}')
    total_files = 0
    processed_files = 0
    modified_files = 0
    
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            # 检查文件扩展名是否在前端文件扩展名列表中
            if any(file.endswith(ext) for ext in FRONTEND_EXTENSIONS):
                file_path = os.path.join(root, file)
                total_files += 1
                try:
                    # 检查文件是否包含Unicode编码
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if re.search(UNICODE_PATTERN, content):
                        # 处理文件并记录是否修改了文件
                        if process_file(file_path):
                            modified_files += 1
                    processed_files += 1
                except Exception as e:
                    print(f'  处理文件 {file_path} 时出错: {str(e)}')
    
    print(f'共处理了 {processed_files}/{total_files} 个文件，修改了 {modified_files} 个文件')
    return processed_files, modified_files

def main():
    # 处理前端目录下的所有文件
    frontend_dir = 'frontend'
    frontend_path = os.path.join(os.getcwd(), frontend_dir)
    
    if os.path.isdir(frontend_path):
        print(f'开始处理前端目录: {frontend_path}')
        processed_files, modified_files = process_directory(frontend_path)
        print(f'前端目录处理完成: 共处理了 {processed_files} 个文件，修改了 {modified_files} 个文件')
    else:
        print(f'前端目录不存在: {frontend_path}')
        
    # 如果命令行参数中指定了其他目录，也处理这些目录
    if len(sys.argv) > 1:
        for dir_path in sys.argv[1:]:
            if os.path.isdir(dir_path):
                print(f'\n开始处理指定目录: {dir_path}')
                processed_files, modified_files = process_directory(dir_path)
                print(f'指定目录处理完成: 共处理了 {processed_files} 个文件，修改了 {modified_files} 个文件')
            else:
                print(f'指定目录不存在: {dir_path}')

if __name__ == '__main__':
    main()
