from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import json
import asyncio
import uuid
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from app.services.deepseek_service import generate_response, generate_streaming_response, analyze_sql_query
from app.services.conversation_handler import process_conversation_message, process_conversation_with_history, stream_conversation_message
from app.core.security import get_current_user
from app.models.user import UserInDB as User
from app.schemas.message import MessageCreate, MessageResponse
from app.crud.conversation import create_conversation, add_message_to_conversation, get_conversation
from app.db.mongodb import db

router = APIRouter()

# 聊天请求模型
class ChatRequest:
    def __init__(self, messages: List[Dict[str, str]], stream: bool = False, system_prompt: Optional[str] = None):
        self.messages = messages
        self.stream = stream
        self.system_prompt = system_prompt

# 创建会话请求模型
class CreateConversationRequest(BaseModel):
    title: str
    user_id: Optional[str] = None

@router.post("/completions", response_model=Dict[str, Any])
async def chat_completions(request: Request):
    """
    处理聊天请求，返回AI回复
    """
    try:
        # 解析请求体
        body = await request.json()
        chat_request = ChatRequest(
            messages=body.get("messages", []),
            stream=body.get("stream", False),
            system_prompt=body.get("systemPrompt")
        )
        
        # 获取用户消息
        user_message = ""
        for message in chat_request.messages:
            if message.get("role") == "user":
                user_message = message.get("content", "")
        
        if not user_message:
            raise HTTPException(status_code=400, detail="未找到用户消息")
        
        # 使用新的对话处理服务
        response = await process_conversation_message(user_message)
        
        # 添加对话 ID
        response["id"] = f"chatcmpl-{asyncio.current_task().get_name()}"
        
        # 如果有SQL分析结果，添加visualizationType字段
        if "sql" in response:
            response["visualizationType"] = response.get("visualization_type")
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理聊天请求失败: {str(e)}")

@router.post("/conversations", response_model=Dict[str, Any])
async def create_new_conversation(request: CreateConversationRequest,current_user: User = Depends(get_current_user)):
    """
    创建新的会话，在conversations集合中插入一条记录
    """
    try:
        user_id = str(current_user.id)
        # 创建新的会话记录
        conversation_id = str(ObjectId())
        new_conversation = {
            "_id": ObjectId(conversation_id),
            "title": request.title,
            # "user_id": request.user_id,user_id = str(current_user.id)
            "user_id": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # 插入到conversations集合
        result = await db.db.conversations.insert_one(new_conversation)
        
        # 返回创建成功的会话信息
        return {
            "id": conversation_id,
            "title": request.title,
            "user_id": request.user_id,
            "created_at": datetime.now().isoformat(),
            "message": "会话创建成功"
        }
    except Exception as e:
        print(f"创建会话时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")


@router.get("/conversations", response_model=Dict[str, Any])
async def get_conversations(
    request: Request,  # 添加Request参数
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(10, ge=1, le=100, description="每页数量"),
    sort: str = Query("updated_at:desc", description="排序方式 (field:asc|desc)"),
    current_user: User = Depends(get_current_user)  # 使用认证依赖
):
    """
    根据用户ID获取分页会话列表
    """
    try:
        # 直接使用认证后的用户ID
        user_id = str(current_user.id)
        
        # 解析排序参数
        sort_field, sort_order = "updated_at", -1
        if ":" in sort:
            sort_field, sort_direction = sort.split(":")
            sort_order = -1 if sort_direction.lower() == "desc" else 1
        
        # 构建查询过滤器
        query_filter = {"user_id": user_id}  # 根据user_id过滤
        
        # 计算分页
        skip = (page - 1) * limit
        
        # 查询会话列表（带用户过滤）
        conversations_cursor = db.db.conversations.find(query_filter) \
            .sort(sort_field, sort_order) \
            .skip(skip) \
            .limit(limit)
        
        total_count = await db.db.conversations.count_documents(query_filter)
        
        # 处理结果
        conversations = []
        async for conv in conversations_cursor:
            # 获取关联消息（可选）
            messages = await db.db.messages.find(
                {"conversation_id": conv["_id"]}
            ).sort("timestamp", 1).to_list(length=None)
            
            conversations.append({
                "id": str(conv["_id"]),
                "title": conv["title"],
                "user_id": conv["user_id"],
                "created_at": conv["created_at"].isoformat(),
                "updated_at": conv["updated_at"].isoformat(),
                "message_count": len(messages)  # 只返回消息数量而非全部内容
            })
        
        return {
            "data": conversations,
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": (total_count + limit - 1) // limit,
                "has_next": page < (total_count + limit - 1) // limit,
                "has_prev": page > 1
            },
            "message": "获取会话列表成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

@router.delete("/conversations/{conversation_id}", response_model=Dict[str, Any])
async def delete_conversation(conversation_id: str):
    """
    删除指定的会话及其相关消息
    """
    try:
        # 尝试转换会话ID为ObjectId
        try:
            conversation_obj_id = ObjectId(conversation_id)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"无效的会话ID格式: {str(e)}")
        
        # 首先检查会话是否存在
        conversation = await db.db.conversations.find_one({"_id": conversation_obj_id})
        if not conversation:
            raise HTTPException(status_code=404, detail=f"未找到ID为{conversation_id}的会话")
        
        # 先删除与该会话相关的所有消息
        delete_messages_result = await db.db.messages.delete_many({"conversation_id": conversation_obj_id})
        deleted_messages_count = delete_messages_result.deleted_count
        
        # 然后删除会话本身
        delete_conversation_result = await db.db.conversations.delete_one({"_id": conversation_obj_id})
        
        if delete_conversation_result.deleted_count == 0:
            raise HTTPException(status_code=500, detail=f"删除会话失败")
        
        # 返回删除成功的信息
        return {
            "id": conversation_id,
            "deleted_messages_count": deleted_messages_count,
            "message": "会话及其相关消息已成功删除"
        }
    except HTTPException as e:
        # 直接抛出已经格式化的HTTP异常
        raise e
    except Exception as e:
        print(f"删除会话时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除会话失败: {str(e)}")

class UpdateConversationRequest(BaseModel):
    title: str  # 只包含可更新的字段

@router.put("/conversations/{conversation_id}", response_model=Dict[str, Any])
async def update_conversation(
    conversation_id: str,
    updates: UpdateConversationRequest
):
    """
    更新会话信息
    - 只能修改title字段
    - 自动更新updated_at时间戳
    """
    try:
        # 验证会话ID格式
        try:
            conversation_oid = ObjectId(conversation_id)
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的会话ID格式"
            )

        # 构建更新内容
        update_data = {
            "title": updates.title,
            "updated_at": datetime.now()
        }

        # 执行更新操作
        result = await db.db.conversations.update_one(
            {"_id": conversation_oid},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在或数据未变更"
            )

        # 返回更新后的完整会话数据
        updated_conv = await db.db.conversations.find_one({"_id": conversation_oid})
        if not updated_conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )

        return {
            "id": str(updated_conv["_id"]),
            "title": updated_conv["title"],
            "user_id": updated_conv["user_id"],
            "created_at": updated_conv["created_at"].isoformat(),
            "updated_at": updated_conv["updated_at"].isoformat(),
            "message": "会话更新成功"
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新会话失败: {str(e)}"
        )

@router.post("/stream", response_class=StreamingResponse)
async def chat_stream(request: Request):
    """
    处理流式聊天请求，存储用户消息到MongoDB的message集合，并以流式返回响应
    """
    try:
        # 从请求中获取消息历史和其他信息
        body = await request.json()
        print(f"收到前端请求: {body}")
        
        messages = body.get("messages", [])
        system_prompt = body.get("systemPrompt", "")
        
        # 获取最新的用户消息
        latest_user_message = ""
        conversation_id = None
        
        # 从消息历史中提取对话信息
        for message in reversed(messages):
            if message.get("role") == "user" and message.get("content").strip():
                latest_user_message = message.get("content")
                break
        
        # 如果没有找到用户消息，返回错误
        if not latest_user_message:
            print("未找到有效的用户消息")
            raise HTTPException(status_code=400, detail="未找到用户消息")
        
        # 获取或创建对话 ID
        conversation_id = body.get("conversation_id", None)  # 默认为None
        print(f"对话ID: {conversation_id}")
        
        # 如果前端没有提供conversation_id，生成一个新的
        if conversation_id is None:
            # 生成新的对话ID
            conversation_id = str(ObjectId())
            print(f"生成新对话ID: {conversation_id}")
            
            # 创建新对话
            title = latest_user_message[:20] + "..." if len(latest_user_message) > 20 else latest_user_message
            new_conversation = {
                "_id": ObjectId(conversation_id),
                "title": title,
                "user_id": None,  # 可以在认证后设置用户ID
                "created_at": datetime.now()
            }
            
            # 插入到conversations集合
            await db.db.conversations.insert_one(new_conversation)
            print(f"创建了新对话: {conversation_id}")
        else:
            # 检查对话是否存在
            try:
                conversation_id_obj = ObjectId(conversation_id)
                existing_conv = await db.db.conversations.find_one({"_id": conversation_id_obj})
                
                if not existing_conv:
                    # 如果对话不存在，创建新对话
                    title = latest_user_message[:20] + "..." if len(latest_user_message) > 20 else latest_user_message
                    new_conversation = {
                        "_id": ObjectId(conversation_id),
                        "title": title,
                        "user_id": None,
                        "created_at": datetime.now()
                    }
                    
                    # 插入到conversations集合
                    await db.db.conversations.insert_one(new_conversation)
                    print(f"创建了新对话(使用提供的ID): {conversation_id}")
            except Exception as e:
                print(f"检查对话时出错: {str(e)}")
                # 创建新对话
                conversation_id = str(ObjectId())
                title = latest_user_message[:20] + "..." if len(latest_user_message) > 20 else latest_user_message
                new_conversation = {
                    "_id": ObjectId(conversation_id),
                    "title": title,
                    "user_id": None,
                    "created_at": datetime.now()
                }
                
                # 插入到conversations集合
                await db.db.conversations.insert_one(new_conversation)
                print(f"创建了新对话(ID转换失败): {conversation_id}")
        
        # 创建用户消息并存储到message集合
        user_message = {
            "_id": ObjectId(),
            "message": latest_user_message,
            "conversation_id": ObjectId(conversation_id),
            "role": "user",
            "created_at": datetime.now()
        }
        
        # 插入用户消息到messages集合
        await db.db.messages.insert_one(user_message)
        print(f"添加了用户消息到messages集合: {str(user_message['_id'])}")
        
        # 创建流式响应生成器
        async def stream_generator():
            try:
                # 发送SSE头部
                yield "data: {\"id\": \"stream-start\", \"choices\": [{\"delta\": {\"role\": \"assistant\"}}]}\n\n"
                
                # 生成AI回复内容
                ai_response = ""
                response_chunks = ["你好", "！", "我是", "AI", "助手", "，", "很高兴", "为您", "服务", "。", "请问", "有什么", "可以", "帮助", "您的", "吗？"]
                
                # 流式返回AI回复
                for chunk in response_chunks:
                    ai_response += chunk
                    response_chunk = {
                        "id": f"chatcmpl-{uuid.uuid4().hex[:10]}",
                        "choices": [
                            {
                                "delta": {
                                    "content": chunk
                                }
                            }
                        ]
                    }
                    yield f"data: {json.dumps(response_chunk, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.1)
                
                # 保存AI回复到messages集合
                ai_message = {
                    "_id": ObjectId(),
                    "message": ai_response,
                    "conversation_id": ObjectId(conversation_id),
                    "role": "assistant",
                    "created_at": datetime.now()
                }
                
                await db.db.messages.insert_one(ai_message)
                print(f"添加了AI回复到messages集合: {str(ai_message['_id'])}")
                
                # 发送结束标记
                yield "data: [DONE]\n\n"
            except Exception as e:
                print(f"生成流式响应时出错: {str(e)}")
                error_response = {
                    "id": f"error-{uuid.uuid4().hex[:10]}",
                    "choices": [
                        {
                            "delta": {
                                "content": f"错误: {str(e)}"
                            }
                        }
                    ]
                }
                yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
        
        # 返回流式响应
        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
    except Exception as e:
        print(f"处理请求时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理流式聊天请求失败: {str(e)}")
    
@router.post("/completions/authenticated", response_model=Dict[str, Any])
async def authenticated_chat_completions(request: Request, current_user: User = Depends(get_current_user)):
    """
    处理需要认证的聊天请求，返回AI回复并保存到数据库
    """
    try:
        # 解析请求体
        body = await request.json()
        chat_request = ChatRequest(
            messages=body.get("messages", []),
            stream=body.get("stream", False),
            system_prompt=body.get("systemPrompt")
        )
        
        # 获取用户消息和会话ID
        user_message = ""
        for message in chat_request.messages:
            if message.get("role") == "user":
                user_message = message.get("content", "")
        
        conversation_id = body.get("conversation_id")
        
        if not user_message:
            raise HTTPException(status_code=400, detail="未找到用户消息")
        
        # 如果没有会话ID，创建新会话
        if not conversation_id:
            # 使用用户消息的前20个字符作为会话标题
            title = user_message[:20] + "..." if len(user_message) > 20 else user_message
            conversation = await create_conversation(title, str(current_user.id))
            conversation_id = str(conversation.id)
            
            # 使用新的对话处理服务
            response = await process_conversation_message(user_message, conversation_id, str(current_user.id))
        else:
            # 如果有现有对话，使用带历史记录的处理服务
            response = await process_conversation_with_history(user_message, conversation_id, str(current_user.id))
        
        # 添加对话 ID
        response["id"] = f"chatcmpl-{asyncio.current_task().get_name()}"
        response["conversation_id"] = conversation_id
        
        # 如果有SQL分析结果，添加visualizationType字段
        if "sql" in response:
            response["visualizationType"] = response.get("visualization_type")
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理聊天请求失败: {str(e)}")
