from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import uuid

from app.services.deepseek_service import generate_response, generate_streaming_response, analyze_sql_query
from app.schemas.message import MessageCreate
from app.crud.conversation import add_message_to_conversation, get_conversation

async def process_conversation_message(user_message: str, conversation_id: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    处理对话消息，调用DeepSeek API生成回复，并保存到数据库
    
    参数:
        user_message: 用户消息内容
        conversation_id: 对话ID（如果是现有对话）
        user_id: 用户ID（如果用户已登录）
        
    返回:
        包含AI回复和元数据的字典
    """
    try:
        # 生成回复
        response_content = await generate_response(user_message)
        
        # 尝试分析SQL查询
        sql_analysis = None
        if "sql" in user_message.lower() or "查询" in user_message or "统计" in user_message:
            try:
                sql_analysis = await analyze_sql_query(user_message)
            except Exception as e:
                print(f"SQL分析失败: {str(e)}")
        
        # 创建响应数据
        timestamp = datetime.now().isoformat()
        message_id = str(uuid.uuid4())
        
        # 如果用户已登录且提供了conversation_id，则保存消息到数据库
        if user_id and conversation_id:
            # 创建用户消息
            user_message_obj = MessageCreate(
                content=user_message,
                role="user",
                conversation_id=conversation_id
            )
            
            # 创建系统回复
            system_message = MessageCreate(
                content=response_content,
                role="assistant",
                conversation_id=conversation_id
            )
            
            # 保存消息到数据库
            await add_message_to_conversation(conversation_id, user_message_obj)
            await add_message_to_conversation(conversation_id, system_message)
        
        # 构建响应
        response = {
            "id": message_id,
            "content": response_content,
            "timestamp": timestamp,
            "conversation_id": conversation_id
        }
        
        # 如果有SQL分析结果，添加到响应中
        if sql_analysis and sql_analysis.get("sql"):
            response["sql"] = sql_analysis.get("sql")
            response["visualization_type"] = sql_analysis.get("visualization_type")
            response["explanation"] = sql_analysis.get("explanation")
        
        return response
    except Exception as e:
        print(f"处理对话消息时出错: {str(e)}")
        return {
            "id": str(uuid.uuid4()),
            "content": f"很抱歉，处理您的消息时出现了错误: {str(e)}",
            "timestamp": datetime.now().isoformat(),
            "conversation_id": conversation_id,
            "error": True
        }

async def process_conversation_with_history(user_message: str, conversation_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    处理带有历史记录的对话消息
    
    参数:
        user_message: 用户消息内容
        conversation_id: 对话ID
        user_id: 用户ID（如果用户已登录）
        
    返回:
        包含AI回复和元数据的字典
    """
    try:
        # 获取对话历史
        conversation = await get_conversation(conversation_id)
        if not conversation:
            return await process_conversation_message(user_message, conversation_id, user_id)
        
        # 提取历史消息，最多取最近10条
        history_messages = conversation.get("messages", [])[-10:]
        history = [
            {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            for msg in history_messages
        ]
        
        # 生成回复
        response_content = await generate_response(user_message, history=history)
        
        # 尝试分析SQL查询
        sql_analysis = None
        if "sql" in user_message.lower() or "查询" in user_message or "统计" in user_message:
            try:
                sql_analysis = await analyze_sql_query(user_message)
            except Exception as e:
                print(f"SQL分析失败: {str(e)}")
        
        # 创建响应数据
        timestamp = datetime.now().isoformat()
        message_id = str(uuid.uuid4())
        
        # 如果用户已登录，则保存消息到数据库
        if user_id:
            # 创建用户消息
            user_message_obj = MessageCreate(
                content=user_message,
                role="user",
                conversation_id=conversation_id
            )
            
            # 创建系统回复
            system_message = MessageCreate(
                content=response_content,
                role="assistant",
                conversation_id=conversation_id
            )
            
            # 保存消息到数据库
            await add_message_to_conversation(conversation_id, user_message_obj)
            await add_message_to_conversation(conversation_id, system_message)
        
        # 构建响应
        response = {
            "id": message_id,
            "content": response_content,
            "timestamp": timestamp,
            "conversation_id": conversation_id
        }
        
        # 如果有SQL分析结果，添加到响应中
        if sql_analysis and sql_analysis.get("sql"):
            response["sql"] = sql_analysis.get("sql")
            response["visualization_type"] = sql_analysis.get("visualization_type")
            response["explanation"] = sql_analysis.get("explanation")
        
        return response
    except Exception as e:
        print(f"处理带有历史记录的对话消息时出错: {str(e)}")
        return {
            "id": str(uuid.uuid4()),
            "content": f"很抱歉，处理您的消息时出现了错误: {str(e)}",
            "timestamp": datetime.now().isoformat(),
            "conversation_id": conversation_id,
            "error": True
        }

async def stream_conversation_message(user_message: str, conversation_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    流式处理对话消息
    
    参数:
        user_message: 用户消息内容
        conversation_id: 对话ID（如果是现有对话）
        user_id: 用户ID（如果用户已登录）
        
    返回:
        生成器，产生流式响应片段
    """
    try:
        # 如果有对话ID，获取对话历史
        history = None
        if conversation_id:
            conversation = await get_conversation(conversation_id)
            if conversation:
                # 提取历史消息，最多取最近10条
                history_messages = conversation.get("messages", [])[-10:]
                history = [
                    {"role": msg.get("role", "user"), "content": msg.get("content", "")}
                    for msg in history_messages
                ]
        
        # 保存用户消息到数据库
        if user_id and conversation_id:
            user_message_obj = MessageCreate(
                content=user_message,
                role="user",
                conversation_id=conversation_id
            )
            await add_message_to_conversation(conversation_id, user_message_obj)
        
        # 生成流式回复
        full_response = ""
        async for chunk in generate_streaming_response(user_message, history=history):
            full_response += chunk
            yield chunk
        
        # 保存完整的AI回复到数据库
        if user_id and conversation_id and full_response:
            system_message = MessageCreate(
                content=full_response,
                role="assistant",
                conversation_id=conversation_id
            )
            await add_message_to_conversation(conversation_id, system_message)
            
    except Exception as e:
        print(f"流式处理对话消息时出错: {str(e)}")
        yield f"很抱歉，处理您的消息时出现了错误: {str(e)}"
