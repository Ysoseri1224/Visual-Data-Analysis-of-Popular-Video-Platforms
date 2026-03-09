"""
同步MongoDB中的消息记录到记忆库
此脚本会直接从messages表中获取记录，每两条消息（用户问题和系统回答）作为一组
处理为一条记忆，并显示在记忆库管理界面中
"""
import asyncio
import os
import sys
import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.models.user import UserInDB
from app.models.conversation import ConversationInDB, Message

# MongoDB连接信息
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "stardata")

async def connect_to_db():
    """连接到MongoDB数据库"""
    print(f"连接到MongoDB: {MONGODB_URL}, 数据库: {MONGODB_DB_NAME}")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]
    return client, db

async def get_or_create_user(db):
    """获取现有用户或创建一个默认用户"""
    # 尝试获取第一个管理员用户
    user = await db.users.find_one({"role": "admin"})
    
    if not user:
        # 尝试获取任何用户
        user = await db.users.find_one({})
    
    if not user:
        # 如果没有用户，创建一个默认用户
        print("未找到用户，创建默认用户")
        user_id = ObjectId()
        user = {
            "_id": user_id,
            "username": "admin",
            "email": "admin@example.com",
            "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # 密码: password
            "role": "admin",
            "created_at": datetime.datetime.utcnow()
        }
        await db.users.insert_one(user)
        print(f"创建默认用户成功，ID: {user_id}")
    else:
        print(f"使用现有用户，ID: {user['_id']}")
    
    return user

async def get_or_create_memory_conversation(db, user_id):
    """获取或创建记忆库对话"""
    # 尝试查找专门用于记忆的对话
    memory_conversation = await db.conversations.find_one({
        "user_id": ObjectId(user_id),
        "title": "记忆库对话"
    })
    
    # 如果找不到，创建一个新的记忆库对话
    if not memory_conversation:
        print("创建新的记忆库对话")
        memory_conversation = {
            "_id": ObjectId(),
            "title": "记忆库对话",
            "user_id": ObjectId(user_id),
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
            "messages": []
        }
        await db.conversations.insert_one(memory_conversation)
        print(f"创建记忆库对话成功，ID: {memory_conversation['_id']}")
    else:
        print(f"使用现有记忆库对话，ID: {memory_conversation['_id']}")
    
    return memory_conversation

async def sync_messages(db, user_id):
    """直接从messages表中获取消息并按问答对同步到记忆库"""
    # 获取所有消息并按时间排序
    messages_cursor = db.messages.find({}).sort("timestamp", 1)
    messages = await messages_cursor.to_list(length=None)
    
    print(f"找到 {len(messages)} 条消息记录")
    
    # 按用户和系统消息分类
    user_messages = [msg for msg in messages if msg.get("role") == "user"]
    system_messages = [msg for msg in messages if msg.get("role") == "system" or msg.get("role") == "assistant"]
    
    print(f"用户消息数: {len(user_messages)}, 系统消息数: {len(system_messages)}")
    
    # 获取或创建记忆库专用对话
    memory_conversation = await get_or_create_memory_conversation(db, user_id)
    conversation_id = str(memory_conversation["_id"])
    
    # 清空现有记忆
    current_messages = memory_conversation.get("messages", [])
    if current_messages:
        print(f"清除现有的 {len(current_messages)} 条记忆消息")
        await db.conversations.update_one(
            {"_id": memory_conversation["_id"]},
            {"$set": {"messages": []}}
        )
    
    # 将消息应用到记忆库小助手函数
    async def add_message_to_memory(role, content, timestamp=None):
        if not timestamp:
            timestamp = datetime.datetime.utcnow()
            
        message = {
            "role": role,
            "message": content,
            "timestamp": timestamp
        }
        
        await db.conversations.update_one(
            {"_id": memory_conversation["_id"]},
            {"$push": {"messages": message}}
        )
    
    # 配对用户和系统消息
    memory_pairs = []
    
    # 首先，我们尝试使用conversation_id匹配并按时间排序
    for user_msg in user_messages:
        user_content = user_msg.get("message", user_msg.get("content", ""))
        user_time = user_msg.get("timestamp", user_msg.get("created_at", datetime.datetime.utcnow()))
        user_conv_id = user_msg.get("conversation_id")
        
        # 找到用户消息后的第一条系统回复
        system_response = None
        for sys_msg in system_messages:
            sys_conv_id = sys_msg.get("conversation_id")
            sys_time = sys_msg.get("timestamp", sys_msg.get("created_at", datetime.datetime.utcnow()))
            
            # 如果对话ID匹配且时间在用户消息之后
            if (user_conv_id and user_conv_id == sys_conv_id and sys_time > user_time):
                system_response = sys_msg
                system_messages.remove(sys_msg)  # 移除已配对的系统消息
                break
        
        # 如果找到匹配的系统消息，添加到配对列表
        if system_response:
            system_content = system_response.get("message", system_response.get("content", ""))
            memory_pairs.append({
                "user": user_content,
                "system": system_content,
                "user_time": user_time,
                "system_time": system_response.get("timestamp", system_response.get("created_at", datetime.datetime.utcnow()))
            })
    
    # 将消息对同步到记忆库对话
    print(f"同步 {len(memory_pairs)} 对问答消息到记忆库")
    
    for pair in memory_pairs:
        # 添加用户问题
        await add_message_to_memory("user", pair["user"], pair["user_time"])
        # 添加系统回答
        await add_message_to_memory("system", pair["system"], pair["system_time"])
        
    # 更新最后修改时间
    await db.conversations.update_one(
        {"_id": memory_conversation["_id"]},
        {"$set": {"updated_at": datetime.datetime.utcnow()}}
    )
    
    print("同步消息完成，请刷新记忆库管理页面查看效果")
    return memory_conversation["_id"]

async def main():
    """主函数"""
    client, db = await connect_to_db()
    try:
        # 获取或创建用户
        user = await get_or_create_user(db)
        
        # 同步消息
        memory_id = await sync_messages(db, str(user["_id"]))
        
        print(f"消息同步完成，记忆库ID: {memory_id}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
