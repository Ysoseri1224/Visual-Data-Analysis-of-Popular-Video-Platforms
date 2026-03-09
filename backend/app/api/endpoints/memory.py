from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Header
from app.models.user import UserInDB
from app.utils.deps import get_current_user
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
from app.services.conversation_service import (
    get_user_conversations,
    get_conversation_by_id,
    delete_conversation
)
import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/conversations")
async def list_memory_conversations(token: str = Depends(oauth2_scheme)):
    # 获取当前用户
    current_user = await get_current_user(token)
    """
    获取用户的所有记忆对话
    """
    logger.info(f"[调试] 开始获取记忆库列表，用户ID: {current_user.id}")
    try:
        # 设置强制调试的测试数据
        logger.info("尝试获取用户对话列表...")
        conversations = await get_user_conversations(str(current_user.id))
        logger.info(f"获取到 {len(conversations)} 个对话")
        
        # 添加一些测试数据，当没有数据时用于调试
        if not conversations:
            # 如果没有对话，添加测试数据供调试使用
            logger.warning("没有实际对话数据，添加测试数据供调试...")
            test_memory_items = [
                {
                    "id": "test_1_0",  # 测试ID
                    "conversation_id": "test_1",
                    "title": "测试问题: 什么是人工智能?",
                    "user_question": "请告诉我什么是人工智能？",
                    "system_answer": "人工智能（AI）是计算机科学的一个分支，致力于开发能够模拟人类智能的机器和系统。它包括机器学习、自然语言处理、计算机视觉等领域。",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=2),
                    "updated_at": datetime.datetime.utcnow() - datetime.timedelta(days=2)
                },
                {
                    "id": "test_1_2",
                    "conversation_id": "test_1",
                    "title": "测试问题: 机器学习的类型",
                    "user_question": "机器学习有哪些主要类型？",
                    "system_answer": "机器学习主要包括监督学习、无监督学习、半监督学习和强化学习。监督学习使用标记数据，无监督学习发现数据中的模式，半监督学习结合了两者的特点，而强化学习则通过试错和奖励机制学习。",
                    "created_at": datetime.datetime.utcnow() - datetime.timedelta(days=1),
                    "updated_at": datetime.datetime.utcnow() - datetime.timedelta(days=1)
                },
                {
                    "id": "test_2_0",
                    "conversation_id": "test_2",
                    "title": "测试问题: Python语言特点",
                    "user_question": "Python语言有哪些主要特点？",
                    "system_answer": "Python的主要特点包括简洁易读的语法、强大的库支持、动态类型、面向对象编程、自动内存管理以及广泛的应用领域如数据分析、机器学习、Web开发等。",
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow()
                }
            ]
            return {
                "status": "success",
                "data": test_memory_items,
                "total": len(test_memory_items)
            }
        
        # 转换为前端所需的格式 - 将每对问答作为一条独立的记忆
        result = []
        for idx, conv in enumerate(conversations):
            # 打印每个对话的基本信息
            logger.info(f"对话 #{idx+1} ID: {conv.id}, 标题: {conv.title}")
            
            # 跳过没有消息的对话
            if not hasattr(conv, "messages") or not conv.messages:
                logger.warning(f"  - 对话 {conv.id} 没有消息")
                continue
                
            logger.info(f"  - 消息数量: {len(conv.messages)}")
            for m_idx, msg in enumerate(conv.messages[:3]):
                logger.info(f"  - 消息 #{m_idx}: {msg.role}, 内容: {msg.message[:50]}...")
            
            # 将消息按问答对组织
            messages = conv.messages
            i = 0
            pair_count = 0
            while i < len(messages) - 1:
                # 确保是用户问题后面跟着系统回答
                if messages[i].role == "user" and i + 1 < len(messages) and messages[i+1].role == "system":
                    user_msg = messages[i]
                    system_msg = messages[i+1]
                    pair_count += 1
                    
                    # 为每对问答创建一条记忆
                    memory_item = {
                        "id": f"{str(conv.id)}_{i}",  # 创建唯一ID
                        "conversation_id": str(conv.id),
                        "title": user_msg.message[:30] + "..." if len(user_msg.message) > 30 else user_msg.message,
                        "user_question": user_msg.message,
                        "system_answer": system_msg.message,
                        "created_at": user_msg.timestamp,
                        "updated_at": system_msg.timestamp
                    }
                    
                    result.append(memory_item)
                i += 1  # 每次处理一条消息
                
            logger.info(f"  - 从对话 {conv.id} 中提取了 {pair_count} 对问答")
            
        # 按时间倒序排序
        result.sort(key=lambda x: x["updated_at"], reverse=True)
        logger.info(f"总计提取了 {len(result)} 对问答记忆")
            
        return {
            "status": "success",
            "data": result,
            "total": len(result)
        }
        
    except Exception as e:
        logger.error(f"获取记忆库对话失败: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"获取记忆库对话失败: {str(e)}"
        }

@router.get("/conversations/{conversation_id}")
async def get_memory_conversation(
    conversation_id: str,
    token: str = Depends(oauth2_scheme)
):
    # 获取当前用户
    current_user = await get_current_user(token)
    """
    获取特定对话的详细内容
    """
    try:
        conversation = await get_conversation_by_id(conversation_id, str(current_user.id))
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在或您无权访问"
            )
            
        return {
            "status": "success",
            "data": conversation
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"获取对话详情失败: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"获取对话详情失败: {str(e)}"
        }

@router.delete("/memory/{memory_id}")
async def delete_memory(
    memory_id: str,
    token: str = Depends(oauth2_scheme)
):
    # 获取当前用户
    current_user = await get_current_user(token)
    """
    删除特定问答记忆
    """
    try:
        # 从 memory_id 中提取对话 ID 和消息索引
        parts = memory_id.split('_')
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的记忆ID格式"
            )
            
        conversation_id = parts[0]
        message_index = int(parts[1])
        
        # 获取对话
        conversation = await get_conversation_by_id(conversation_id, str(current_user.id))
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在或无权访问"
            )
        
        # 确保消息存在且有足够的消息
        if not hasattr(conversation, "messages") or not conversation.get("messages") or len(conversation.get("messages", [])) <= message_index + 1:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="记忆不存在"
            )
        
        # 删除该对问答消息
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        
        # 获取MongoDB连接信息
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        mongodb_db_name = os.getenv("MONGODB_DB_NAME", "stardata") 
        
        client = AsyncIOMotorClient(mongodb_url)
        db = client[mongodb_db_name]
        
        # 从对话中移除这对消息
        messages = conversation.get("messages", [])
        if message_index < len(messages) - 1 and messages[message_index]["role"] == "user" and messages[message_index+1]["role"] == "system":
            # 删除用户和系统消息
            del messages[message_index+1]
            del messages[message_index]
            
            # 更新对话
            await db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {"$set": {"messages": messages, "updated_at": datetime.datetime.utcnow()}}
            )
            
            return {
                "status": "success",
                "message": "记忆已成功删除"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无法删除这对问答消息"
            )
            
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记忆ID格式"
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"删除记忆失败: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"删除记忆失败: {str(e)}"
        }


@router.delete("/conversations/{conversation_id}")
async def delete_memory_conversation(
    conversation_id: str,
    token: str = Depends(oauth2_scheme)
):
    # 获取当前用户
    current_user = await get_current_user(token)
    """
    删除特定对话
    """
    try:
        success = await delete_conversation(conversation_id, str(current_user.id))
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在或删除失败"
            )
            
        return {
            "status": "success",
            "message": "对话已成功删除"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"删除对话失败: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"删除对话失败: {str(e)}"
        }

@router.get("/stats")
async def get_memory_stats(token: str = Depends(oauth2_scheme)):
    # 获取当前用户
    current_user = await get_current_user(token)
    """
    获取记忆库统计信息
    """
    try:
        conversations = await get_user_conversations(str(current_user.id))
        
        total_conversations = len(conversations)
        total_messages = sum(len(conv.messages) if hasattr(conv, "messages") else 0 for conv in conversations)
        
        # 计算最近活跃的对话
        recent_conversations = sorted(
            conversations, 
            key=lambda x: x.updated_at if hasattr(x, "updated_at") else x.created_at, 
            reverse=True
        )[:5]
        
        recent_items = [
            {
                "id": str(conv.id),
                "title": conv.title,
                "updated_at": conv.updated_at if hasattr(conv, "updated_at") else conv.created_at
            }
            for conv in recent_conversations
        ]
        
        return {
            "status": "success",
            "data": {
                "total_conversations": total_conversations,
                "total_messages": total_messages,
                "recent_items": recent_items
            }
        }
        
    except Exception as e:
        logger.error(f"获取记忆库统计失败: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"获取记忆库统计失败: {str(e)}"
        }
