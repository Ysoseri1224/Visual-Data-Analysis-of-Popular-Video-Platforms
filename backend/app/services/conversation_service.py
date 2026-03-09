from datetime import datetime
from typing import List, Optional
from bson import ObjectId

from app.db.mongodb import db
from app.models.conversation import ConversationCreate, ConversationInDB, Message, ConversationUpdate

async def get_conversation_by_id(conversation_id: str, user_id: str = None) -> Optional[dict]:
    """
    通过ID获取对话及其消息
    直接返回字典格式，不使用ConversationInDB类
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    print(f"\n===== 开始获取对话 ID: {conversation_id}, 用户 ID: {user_id} =====")
    # 验证ObjectId
    if not ObjectId.is_valid(conversation_id):
        print(f"\u65e0效的对话 ID: {conversation_id}")
        return None
    
    client = None
    try:
        # 获取MongoDB连接信息
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        mongodb_db_name = os.getenv("MONGODB_DB_NAME", "stardata") 
        
        # 直接创建MongoDB连接
        client = AsyncIOMotorClient(mongodb_url)
        db = client[mongodb_db_name]
        
        # 转换ID并构建查询
        obj_id = ObjectId(conversation_id)
        # print(f"\u8f6c换为ObjectId: {obj_id}")
        
        # 直接按ID查询，不限制user_id
        query = {"_id": obj_id}
        # print(f"\u67e5询条件(仅使用ID): {query}")
        
        # 获取基本对话信息
        # print("\u5f00始从conversations集合获取对话...")
        conversation = await db.conversations.find_one(query)
        
        if not conversation:
            # print(f"\u6ca1有找到对话: {conversation_id}")
            return None
        # else:
        #     print(f"\u6210功找到对话: {conversation.get('title', '无标题')}")
        #     print(f"\u5bf9话内容: {conversation}")
            
        # 不使用ConversationInDB类，直接处理字典格式
        print("\u5904理对话数据...")
        result = {
            "id": str(conversation["_id"]),
            "title": conversation.get("title", ""),
            "user_id": str(conversation.get("user_id", "")),
            "created_at": conversation.get("created_at", datetime.utcnow()),
            "updated_at": conversation.get("updated_at", datetime.utcnow()),
            "messages": []
        }
        
        # 从messages集合中获取该对话的消息
        try:
            # 查询messages集合
            messages_list = []  # 存储最终的消息列表
            # 同时查询ObjectId和字符串格式的conversation_id
            print(f"同时查询ObjectId和字符串格式的conversation_id: {conversation_id}")
            # 使用$or操作符同时匹配两种类型
            query = {
                "$or": [
                    {"conversation_id": ObjectId(conversation_id)},
                    {"conversation_id": conversation_id}
                ]
            }
            cursor = db.messages.find(query)
            
            # 计数器
            count = 0
            async for msg in cursor:
                count += 1
                try:
                    # 处理消息格式，直接转换为字典格式
                    message_dict = {
                        "role": msg.get("role", ""),
                        "message": msg.get("message", msg.get("content", "")),  # 兼容message和content字段
                        "timestamp": msg.get("timestamp", msg.get("created_at", datetime.utcnow())),  # 兼容timestamp和created_at
                    }
                    
                    # 可选字段
                    # if "natural_language" in msg:
                    #     message_dict["natural_language"] = msg["natural_language"]
                    # if "sql_query" in msg:
                    #     message_dict["sql_query"] = msg["sql_query"]
                    # if "visualization_type" in msg:
                    #     message_dict["visualization_type"] = msg["visualization_type"]
                    
                    messages_list.append(message_dict)
                    # print(f"\u6210\u529f\u6dfb\u52a0\u6d88\u606f: {message_dict['role']}: {message_dict['content'][:30]}...")
                    
                except Exception as e:
                    print(f"\u5904\u7406\u5355\u6761\u6d88\u606f\u51fa\u9519: {e}")
                    import traceback
                    print(traceback.format_exc())
                    continue  # 跳过出错的消息
            
            # 更新结果中的消息列表
            if messages_list:
                print(f"\u603b\u5171\u627e\u5230 {len(messages_list)} \u6761\u6d88\u606f\uff0c\u66f4\u65b0\u7ed3\u679c")
                result["messages"] = messages_list
            else:
                print("\u6ca1\u6709\u627e\u5230\u76f8\u5173\u6d88\u606f")
                
        except Exception as e:
            print(f"\u67e5\u8be2\u6d88\u606f\u65f6\u51fa\u9519: {e}")
            import traceback
            print(traceback.format_exc())
            print("\u7ee7续使用嵌入的消息数组")
        
        # 返回结果对象
        return result
        
    except Exception as e:
        print(f"\u83b7\u53d6\u5bf9\u8bdd\u65f6\u51fa\u9519: {e}")
        import traceback
        print(traceback.format_exc())
        return None  # 如果查\u8be2\u8fc7\u7a0b\u51fa\u9519\uff0c\u8fd4\u56deNone
        
    finally:
        # 确保关闭数据库连接
        if client:
            print("\u5173\u95edMongoDB\u8fde\u63a5")
            client.close()
    

async def get_user_conversations(user_id: str) -> List[ConversationInDB]:
    """
    获取用户的所有对话
    """
    if not ObjectId.is_valid(user_id):
        return []
    
    conversations = []
    cursor = db.db.conversations.find({"user_id": ObjectId(user_id)}).sort("updated_at", -1)
    
    async for conversation in cursor:
        conversations.append(ConversationInDB(**conversation))
    
    return conversations

async def create_conversation(conversation_in: ConversationCreate) -> ConversationInDB:
    """
    创建新对话
    """
    conversation_db = ConversationInDB(
        **conversation_in.dict(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        messages=[]
    )
    
    conversation_dict = conversation_db.dict(by_alias=True)
    await db.db.conversations.insert_one(conversation_dict)
    
    return conversation_db

async def update_conversation(conversation_id: str, user_id: str, conversation_in: ConversationUpdate) -> Optional[ConversationInDB]:
    """
    更新对话信息
    """
    conversation = await get_conversation_by_id(conversation_id, user_id)
    if not conversation:
        return None
    
    update_data = conversation_in.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": update_data}
    )
    
    return await get_conversation_by_id(conversation_id, user_id)

async def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """
    删除对话
    """
    if not ObjectId.is_valid(conversation_id) or not ObjectId.is_valid(user_id):
        return False
    
    result = await db.db.conversations.delete_one({
        "_id": ObjectId(conversation_id),
        "user_id": ObjectId(user_id)
    })
    
    return result.deleted_count > 0

async def add_message_to_db(conversation_id: str, message: Message) -> bool:
    """
    将消息添加到messages集合
    """
    if not ObjectId.is_valid(conversation_id):
        return False
        
    # 准备消息数据
    message_dict = message.dict()
    message_dict["conversation_id"] = ObjectId(conversation_id)  # 添加会话ID
    
    # 插入到messages集合
    result = await db.db.messages.insert_one(message_dict)
    
    return result.inserted_id is not None

async def add_message(conversation_id: str, user_id: str = None, message: Message = None) -> Optional[dict]:
    """
    添加消息到对话
    参数user_id现在是可选的
    """
    # 首先检查对话是否存在，不再强制要求user_id
    conversation = await get_conversation_by_id(conversation_id)
    if not conversation:
        return None
    
    # 更新会话的最后修改时间
    await db.db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"updated_at": datetime.utcnow()}}
    )
    
    # 将消息添加到messages集合
    await add_message_to_db(conversation_id, message)
    
    # 获取更新后的会话（包含新消息）
    # 不再传递user_id参数
    return await get_conversation_by_id(conversation_id)

async def get_messages(conversation_id: str, user_id: str = None) -> List[Message]:
    """
    直接从messages集合中获取对话的所有消息
    """
    # 验证对话ID格式
    if not ObjectId.is_valid(conversation_id):
        return []
    
    # 验证对话存在性
    query = {"_id": ObjectId(conversation_id)}
    if user_id and ObjectId.is_valid(user_id):
        query["user_id"] = ObjectId(user_id)
    
    conversation_exists = await db.db.conversations.find_one(query, {"_id": 1})
    if not conversation_exists:
        return []
    
    # 直接查询messages集合
    messages = []
    cursor = db.db.messages.find({"conversation_id": ObjectId(conversation_id)}).sort("timestamp", 1)
    
    async for message in cursor:
        # 移除MongoDB的_id和conversation_id字段
        if "_id" in message:
            del message["_id"]
        if "conversation_id" in message:
            del message["conversation_id"]
        messages.append(Message(**message))
    
    return messages
