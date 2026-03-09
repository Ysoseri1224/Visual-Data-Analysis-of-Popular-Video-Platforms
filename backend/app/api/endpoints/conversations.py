from typing import Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from bson import ObjectId

from app.api.endpoints.auth import get_current_user
from app.models.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    Message
)
from app.models.user import UserInDB
from app.services.conversation_service import (
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation_by_id,
    get_messages,
    get_user_conversations,
    update_conversation
)

router = APIRouter()

@router.get("/", response_model=List[ConversationResponse])
async def read_conversations(current_user: UserInDB = Depends(get_current_user)) -> Any:
    """
    获取当前用户的所有对话
    """
    conversations = await get_user_conversations(str(current_user.id))
    
    return [
        {
            "id": str(conv.id),
            "title": conv.title,
            "user_id": str(conv.user_id),
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "messages": conv.messages
        }
        for conv in conversations
    ]

@router.get("/detail", response_model=ConversationResponse)
async def read_conversation_by_query(
    id: str,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    获取特定对话（使用查询参数）
    """
    print(f"收到获取对话请求(查询参数): id={id}, user_id={current_user.id}")
    
    try:
        # 调用修改后的get_conversation_by_id函数获取对话及其消息
        conversation = await get_conversation_by_id(id, str(current_user.id))
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在"
            )
        
        # 直接返回得到的字典，不再进行属性访问
        # 如果是字典格式，直接返回
        if isinstance(conversation, dict):
            return conversation
        
        # 兼容对象格式
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "user_id": str(conversation.user_id),
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
            "messages": conversation.messages
        }
    except Exception as e:
        print(f"获取对话详情出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取对话详情失败: {str(e)}"
        )

@router.post("/", response_model=dict)
async def create_new_conversation(
    conversation_in: dict,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    创建新对话 - 简化版
    """
    try:
        print(f"收到创建对话请求: {conversation_in}")
        print(f"当前用户: id={current_user.id}, email={current_user.email}")
        
        # 只需要title字段，user_id从当前用户获取
        title = conversation_in.get("title", "新对话")
        print(f"对话标题: {title}")
        
        # 直接使用MongoDB创建对话
        from app.db.mongodb import db
        
        # 准备插入数据
        new_conversation = {
            "title": title,
            "user_id": ObjectId(str(current_user.id)),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "messages": []
        }
        
        print(f"准备插入数据: {new_conversation}")
        
        # 插入数据
        result = await db.db.conversations.insert_one(new_conversation)
        inserted_id = result.inserted_id
        print(f"MongoDB插入结果: {inserted_id}")
        
        # 构建简化的响应
        response = {
            "id": str(inserted_id),
            "title": title,
            "user_id": str(current_user.id),
            "created_at": new_conversation["created_at"],
            "updated_at": new_conversation["updated_at"],
            "messages": []
        }
        
        print(f"对话创建成功: {response}")
        return response
            
    except Exception as e:
        print(f"创建对话时出错: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建对话失败: {str(e)}"
        )

@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation_info(
    conversation_id: str,
    conversation_in: ConversationUpdate,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    更新对话信息
    """
    conversation = await update_conversation(
        conversation_id,
        str(current_user.id),
        conversation_in
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )
    
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "user_id": str(conversation.user_id),
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": conversation.messages
    }

@router.delete("/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    删除对话
    """
    success = await delete_conversation(conversation_id, str(current_user.id))
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )
    
    return {"detail": "对话已删除"}

@router.post("/messages", response_model=ConversationResponse)
async def add_message_to_conversation(
    message_data: dict,  # 使用字典接收请求体数据
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    添加消息到对话 - 会话ID在请求体中传递
    """
    print(f"[添加消息] 接收到添加消息请求，用户ID: {current_user.id}, 请求数据: {message_data}")
    
    # 从请求体中获取会话ID和消息
    conversation_id = message_data.get("conversation_id")
    if not conversation_id:
        print(f"[添加消息] 错误: 请求中缺少会话ID")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少会话ID"
        )
    
    print(f"[添加消息] 会话ID: {conversation_id}")
    
    # 将消息数据转换为Message对象
    try:
        print(f"[添加消息] 开始转换消息数据: {message_data.get('message', {})}")
        message = Message(**message_data.get("message", {}))
        print(f"[添加消息] 成功创建Message对象: {message}")
    except ValidationError as e:
        print(f"[添加消息] 消息格式验证错误: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"消息格式错误: {str(e)}"
        )
    
    # 添加用户消息
    print(f"[添加消息] 开始添加用户消息到会话 {conversation_id}")
    conversation = await add_message(
        conversation_id,
        str(current_user.id),
        message
    )
    
    if not conversation:
        print(f"[添加消息] 错误: 找不到ID为 {conversation_id} 的会话")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )
    
    print(f"[添加消息] 成功添加消息到会话, 消息角色: {message.role}, 消息内容: {message.message[:50]}{'...' if len(message.message) > 50 else ''}")
    
    # 如果是用户消息，生成系统响应
    if message.role == "user":
        print(f"[添加消息] 检测到用户消息，开始生成系统响应")
        try:
            # 导入DeepSeek服务
            from app.services.deepseek_service import generate_response, generate_streaming_response
            
            print(f"[添加消息] 开始处理用户消息: {message.message[:50]}{'...' if len(message.message) > 50 else ''}")
            print(f"[添加消息] 选择的模型类型: {message.model_type or '默认模型'}")
            
            # 根据是否需要流式响应选择不同的处理方式
            is_streaming = message_data.get("stream", False)  # 从请求中获取是否需要流式响应
            print(f"[添加消息] 是否流式响应: {is_streaming}")
            
            full_response = ""
            if is_streaming:
                print(f"[添加消息] 使用流式响应模式")
                # 使用流式响应
                chunks = []
                async for chunk in generate_streaming_response(message.message):
                    chunks.append(chunk)
                    print(f"[流式响应] 收到响应片段: {chunk[:20]}{'...' if len(chunk) > 20 else ''}")
                
                full_response = "".join(chunks)
                print(f"[添加消息] 流式响应完成，总长度: {len(full_response)}")
            else:
                # 使用普通响应
                full_response = await generate_response(message.message)
            
            # 尝试从响应中提取SQL查询
            sql_query = None
            try:
                # 简单的SQL查询提取逻辑，假设响应已经是SQL或包含"SELECT"关键字
                response_text = full_response.strip()
                
                # 检查是否包含SQL的关键特征
                common_sql_keywords = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT"]
                is_likely_sql = any(keyword in response_text.upper() for keyword in common_sql_keywords)
                
                if is_likely_sql:
                    # 如果看起来像是SQL查询，直接使用它
                    sql_query = response_text
                    print(f"[添加消息] 从响应中提取到SQL查询: {sql_query[:50]}{'...' if len(sql_query) > 50 else ''}")
            except Exception as e:
                print(f"[添加消息] 提取SQL查询时出错: {e}")
            
            # 创建系统响应消息，包含SQL查询属性
            system_message = Message(
                role="assistant",
                message=full_response,
                timestamp=datetime.utcnow(),
                model_type=message.model_type,  # 传入模型类型
                sql_query=sql_query  # 设置SQL查询属性
            )
            print(f"[添加消息] 创建系统响应消息: {system_message.message[:50]}{'...' if len(system_message.message) > 50 else ''}")
            
            # 添加系统响应消息
            print(f"[添加消息] 开始添加系统响应消息到会话 {conversation_id}")
            conversation = await add_message(
                conversation_id,
                str(current_user.id),
                system_message
            )
            print(f"[添加消息] 成功添加系统响应消息到会话")
        except Exception as e:
            print(f"[添加消息] 生成系统响应时出错: {e}")
            import traceback
            print(f"[添加消息] 错误详细信息:\n{traceback.format_exc()}")
            
            # 创建错误响应消息
            error_message = Message(
                role="system",
                message=f"很抱歉，处理您的消息时出现错误: {str(e)}",  # 修改：使用message字段
                timestamp=datetime.utcnow()
            )
            print(f"[添加消息] 创建错误响应消息: {error_message.message[:50]}{'...' if len(error_message.message) > 50 else ''}")
            
            # 添加错误响应消息
            print(f"[添加消息] 开始添加错误响应消息到会话 {conversation_id}")
            conversation = await add_message(
                conversation_id,
                str(current_user.id),
                error_message
            )
            print(f"[添加消息] 成功添加错误响应消息到会话")
    
    # 根据conversation是对象还是字典使用不同的访问方式
    if isinstance(conversation, dict):
        print(f"[添加消息] 完成消息处理，返回会话数据，会话ID: {conversation.get('id', conversation.get('_id', '未知'))}，消息数量: {len(conversation.get('messages', []))}")
        # 如果已经是字典，直接返回，但确保id字段格式正确
        result = conversation.copy()
        # 确保id是字符串
        if '_id' in result and 'id' not in result:
            result['id'] = str(result['_id'])
        elif 'id' in result and not isinstance(result['id'], str):
            result['id'] = str(result['id'])
        return result
    else:
        # 是对象，使用属性访问
        print(f"[添加消息] 完成消息处理，返回会话数据，会话ID: {conversation.id}，消息数量: {len(conversation.messages)}")
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "user_id": str(conversation.user_id),
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
            "messages": conversation.messages
        }

@router.get("/{conversation_id}/messages", response_model=List[Message])
async def get_conversation_messages(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    获取对话中的所有消息
    """
    messages = await get_messages(conversation_id, str(current_user.id))
    
    return messages

@router.post("/{conversation_id}/messages/batch", response_model=ConversationResponse)
async def batch_add_messages_to_conversation(
    conversation_id: str,
    messages: List[Message],
    current_user: UserInDB = Depends(get_current_user)
) -> Any:
    """
    批量添加消息到对话
    用于前端定时同步本地消息到后端数据库
    """
    conversation = None
    
    # 验证对话存在性
    existing_conversation = await get_conversation_by_id(conversation_id, str(current_user.id))
    if not existing_conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )
    
    # 按时间戳排序消息
    sorted_messages = sorted(messages, key=lambda x: x.timestamp)
    
    # 批量添加消息
    for message in sorted_messages:
        try:
            conversation = await add_message(
                conversation_id,
                str(current_user.id),
                message
            )
        except Exception as e:
            print(f"添加消息时出错: {e}")
            import traceback
            print(traceback.format_exc())
    
    # 返回更新后的对话
    if conversation:
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "user_id": str(conversation.user_id),
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at,
            "messages": conversation.messages
        }
    else:
        # 如果没有成功添加任何消息，返回原始对话
        return {
            "id": str(existing_conversation.id),
            "title": existing_conversation.title,
            "user_id": str(existing_conversation.user_id),
            "created_at": existing_conversation.created_at,
            "updated_at": existing_conversation.updated_at,
            "messages": existing_conversation.messages
        }
