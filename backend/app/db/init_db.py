import asyncio
from datetime import datetime

from app.db.mongodb import db
from app.core.security import get_password_hash

async def init_db():
    """
    初始化数据库
    """
    # 创建管理员用户（如果不存在）
    admin_user = await db.db.users.find_one({"email": "admin@example.com"})
    
    if not admin_user:
        admin_data = {
            "username": "admin",
            "email": "admin@example.com",
            "hashed_password": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.utcnow(),
            "last_login": None
        }
        
        await db.db.users.insert_one(admin_data)
        print("已创建管理员用户")
    
    # 确保conversations集合存在
    collections = await db.db.list_collection_names()
    if "conversations" not in collections:
        # 创建一个空的conversations集合
        await db.db.create_collection("conversations")
        print("已创建对话集合")

if __name__ == "__main__":
    asyncio.run(init_db())
