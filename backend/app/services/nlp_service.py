import json
import httpx
from typing import Dict, Any, Optional, Tuple

from app.core.config import settings
# 提示词
async def generate_sql_from_natural_language(
    natural_language: str,
    schema_info: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    使用DeepSeek API将自然语言转换为SQL查询
    
    Args:
        natural_language: 用户的自然语言查询
        schema_info: 数据库模式信息
        
    Returns:
        Tuple[Optional[str], Optional[str]]: (SQL查询, 错误信息)
    """
    prompt = f"""
    你是一个专业的SQL转换助手。请将以下自然语言查询转换为标准SQL语句。
    
    数据库模式信息:
    {schema_info}
    
    自然语言查询:
    {natural_language}
    
    请只返回SQL语句，不要包含任何解释或其他文本。确保SQL语句是有效的，并且与提供的数据库模式兼容。
    """
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"
            }
            
            payload = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你是一个专业的SQL转换助手，能够将自然语言查询准确转换为SQL语句。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,  # 低温度以获得更确定性的结果
                "max_tokens": 500
            }
            
            response = await client.post(
                settings.DEEPSEEK_API_URL,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            response_data = response.json()
            
            if response.status_code != 200:
                error_message = response_data.get("error", {}).get("message", "未知错误")
                return None, f"API错误: {error_message}"
            
            sql_query = response_data["choices"][0]["message"]["content"].strip()
            
            # 清理SQL查询（移除可能的代码块标记）
            sql_query = sql_query.replace("```sql", "").replace("```", "").strip()
            
            return sql_query, None
            
    except Exception as e:
        return None, f"发生错误: {str(e)}"

async def validate_sql_query(sql_query: str) -> Tuple[bool, Optional[str]]:
    """
    验证SQL查询的安全性和有效性
    
    Args:
        sql_query: 要验证的SQL查询
        
    Returns:
        Tuple[bool, Optional[str]]: (是否有效, 错误信息)
    """
    # 检查是否包含危险操作
    dangerous_keywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT", "CREATE", "GRANT", "REVOKE"]
    
    for keyword in dangerous_keywords:
        if keyword in sql_query.upper():
            return False, f"SQL查询包含不允许的操作: {keyword}"
    
    return True, None
