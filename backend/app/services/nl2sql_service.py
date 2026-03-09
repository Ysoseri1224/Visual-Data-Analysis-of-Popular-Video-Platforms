"""基于DeepSeek API的NL2SQL服务
直接调用DeepSeek API生成SQL查询，使用专用提示词模板"""
import os
import json
import aiohttp
import asyncio
import sys
from datetime import datetime
from typing import Dict, Any, Optional
import logging

# 设置日志记录
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加nl2sql_model目录到系统路径
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../nl2sql_model')))

# 导入DeepSeek提示词模板
try:
    from nl2sql_model.deepseek_prompt_templates import (
        SYSTEM_PROMPT_TEMPLATE,
        USER_PROMPT_TEMPLATE,
        VISUALIZATION_TYPE_HINTS
    )
except ImportError as e:
    print(f"导入DeepSeek提示词模板失败: {e}")
    raise

# 简化版数据库模式
SIMPLIFIED_SCHEMA = """
表: users
列:
- _id: ObjectId, 主键
- username: String, 用户名
- email: String, 电子邮箱
- password: String, 加密密码
- role: String, 角色(admin/user)
- created_at: Date, 创建时间
- last_login: Date, 最后登录时间

表: conversations
列:
- _id: ObjectId, 主键
- title: String, 对话标题
- user_id: ObjectId, 关联用户ID
- created_at: Date, 创建时间
- updated_at: Date, 更新时间
- messages: Array, 消息列表

表: messages (嵌入在conversations中)
列:
- _id: ObjectId, 主键
- role: String, 角色(user/system)
- content: String, 消息内容
- timestamp: Date, 时间戳
- natural_language: String, 原始自然语言问题
- sql_query: String, 生成的SQL查询
- visualization_type: String, 可视化类型
"""

# DeepSeek API设置
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# API超时设置（秒）
API_TIMEOUT = 25  # 设置为25秒，比前端的30秒略短

# 从文件读取API密钥
def get_deepseek_api_key():
    """从文件读取DeepSeek API密钥"""
    api_key_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../deepseek_api_key.txt'))
    try:
        with open(api_key_path, 'r') as f:
            api_key = f.read().strip()
            logger.info("成功读取DeepSeek API密钥")
            return api_key
    except Exception as e:
        logger.error(f"读取DeepSeek API密钥失败: {e}")
        # 返回默认密钥（测试用）
        return "sk-78df017dca4e4db896f23be28c435e61"

async def call_deepseek_api(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """调用DeepSeek API生成响应"""
    api_key = get_deepseek_api_key()
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,  # 低温度以获得更确定的结果
        "max_tokens": 1000
    }
    
    logger.info(f"发送请求到DeepSeek API...")
    logger.debug(f"System prompt: {system_prompt[:100]}...")
    logger.debug(f"User prompt: {user_prompt[:100]}...")
    
    try:
        # 设置超时
        timeout = aiohttp.ClientTimeout(total=API_TIMEOUT)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.post(DEEPSEEK_API_URL, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info("DeepSeek API响应成功")
                        return {
                            "success": True,
                            "content": result['choices'][0]['message']['content'],
                            "error": None
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"DeepSeek API调用失败: HTTP {response.status}, {error_text}")
                        return {
                            "success": False,
                            "content": None,
                            "error": f"API调用失败: HTTP {response.status}, {error_text}"
                        }
            except asyncio.TimeoutError:
                logger.error(f"DeepSeek API调用超时 (>{API_TIMEOUT}秒)")
                return {
                    "success": False,
                    "content": None,
                    "error": f"API调用超时 (>{API_TIMEOUT}秒)"
                }
    except Exception as e:
        logger.error(f"调用DeepSeek API时出错: {str(e)}")
        return {
            "success": False,
            "content": None,
            "error": f"API调用异常: {str(e)}"
        }

async def generate_sql_from_nl(question: str, visualization_type: str = "bar") -> Dict[str, Any]:
    """使用DeepSeek API从自然语言生成SQL查询"""
    logger.info(f"收到问题: {question}, 可视化类型: {visualization_type}")
    
    # 准备提示词
    # 获取可视化类型特定的提示
    type_hint = VISUALIZATION_TYPE_HINTS.get(visualization_type, "")
    
    # 生成系统提示词
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        visualization_type=visualization_type,
        schema=SIMPLIFIED_SCHEMA
    )
    
    # 生成用户提示词
    user_prompt = USER_PROMPT_TEMPLATE.format(
        visualization_type=visualization_type,
        question=question
    )
    
    # 如果有特定类型的提示，添加到用户提示中
    if type_hint:
        user_prompt += f"\n\n{type_hint}"
    
    # 调用DeepSeek API
    api_result = await call_deepseek_api(system_prompt, user_prompt)
    
    if api_result["success"] and api_result["content"]:
        # 获取API响应内容
        sql_query = api_result["content"]
        
        # 清理SQL查询（移除可能的标记和额外文本）
        sql_query = sql_query.strip()
        
        # 移除可能的Markdown代码块标记
        if sql_query.startswith("```sql"):
            sql_query = sql_query[6:]
        if sql_query.startswith("```"):
            sql_query = sql_query[3:]
        if sql_query.endswith("```"):
            sql_query = sql_query[:-3]
            
        sql_query = sql_query.strip()
        
        logger.info(f"成功生成SQL查询: {sql_query[:50]}...")
        
        return {
            "question": question,
            "sql_query": sql_query,
            "visualization_type": visualization_type
        }
    else:
        # 如果API调用失败，返回一个默认响应和错误信息
        error_message = api_result.get("error", "未知错误")
        logger.error(f"生成SQL查询失败: {error_message}")
        
        return {
            "question": question,
            "sql_query": "SELECT * FROM users LIMIT 10;",  # 默认查询
            "visualization_type": visualization_type,
            "error": f"无法生成SQL查询: {error_message}"
        }

async def process_user_message(message_content: str, model_type: Optional[str] = None) -> Dict[str, Any]:
    """处理用户消息，生成SQL查询和可视化建议
    
    参数:
        message_content: 用户消息内容
        model_type: 模型类型，如't5'或'deepseek'
    """
    logger.info(f"处理用户消息: {message_content[:50]}...")
    logger.info(f"使用模型类型: {model_type or '默认模型'}")
    
    # 默认响应值
    default_sql = "SELECT * FROM users LIMIT 10;"
    default_viz_type = "table"
    
    try:
        # 确定最佳可视化类型（简单版本，后续可扩展）
        visualization_type = "bar"  # 默认类型
        logger.info(f"选择的可视化类型: {visualization_type}")
        
        try:
            # 尝试生成SQL查询，但设置超时
            # 传递模型类型参数，如果支持的话
            # 对于现有实现，我们可能只是记录这个参数，不实际影响处理逻辑
            # 未来可以根据不同模型类型调用不同的处理逻辑
            logger.info(f"调用SQL生成函数，使用模型: {model_type or '默认模型'}")
            result = await asyncio.wait_for(
                generate_sql_from_nl(message_content, visualization_type),
                timeout=5.0  # 5秒超时
            )
        except asyncio.TimeoutError:
            logger.warning("SQL生成超时，使用默认响应")
            # 超时时使用默认响应
            return {
                "content": f"我正在处理您的请求，但需要更多时间。这是一个基本查询:\n```sql\n{default_sql}\n```\n\n您可以稍后再试。",
                "natural_language": message_content,
                "sql_query": default_sql,
                "visualization_type": default_viz_type,
                "status": "partial"
            }
        except Exception as api_error:
            logger.error(f"调用API生成SQL时出错: {str(api_error)}")
            # API调用错误时使用默认响应
            return {
                "content": f"我在分析您的问题时遇到了技术困难，但这是一个基本查询:\n```sql\n{default_sql}\n```\n\n技术详情: {str(api_error)}",
                "natural_language": message_content,
                "sql_query": default_sql,
                "visualization_type": default_viz_type,
                "status": "error",
                "error": str(api_error)
            }
        
        # 检查是否有错误
        if "error" in result:
            error_message = result["error"]
            logger.warning(f"SQL生成过程中出现警告: {error_message}")
            
            # 构建包含错误信息的响应
            response_content = f"我在处理您的问题时遇到了一些困难，但我尝试生成了一个基本查询:\n```sql\n{result['sql_query']}\n```\n"
            response_content += f"\n注意: {error_message}"
            response_content += f"\n我建议使用{visualization_type}图表来可视化这些结果。"
        else:
            # 构建正常响应
            response_content = f"根据您的问题，我生成了以下SQL查询:\n```sql\n{result['sql_query']}\n```\n"
            response_content += f"\n我建议使用{visualization_type}图表来可视化这些结果。"
        
        logger.info("成功处理用户消息并生成响应")
        
        return {
            "content": response_content,
            "natural_language": message_content,
            "sql_query": result.get("sql_query"),
            "visualization_type": visualization_type,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"处理用户消息时出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        # 返回错误响应，但确保不会导致500错误
        return {
            "content": f"抱歉，我在处理您的请求时遇到了问题，但我会继续为您服务。这是一个基本查询:\n```sql\n{default_sql}\n```",
            "natural_language": message_content,
            "sql_query": default_sql,
            "visualization_type": default_viz_type,
            "status": "error",
            "error": str(e)
        }
