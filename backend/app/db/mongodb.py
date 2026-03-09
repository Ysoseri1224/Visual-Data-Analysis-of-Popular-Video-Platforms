from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db = MongoDB()

async def connect_to_mongo():
    """连接到MongoDB数据库"""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db.db = db.client[settings.MONGODB_DB_NAME]
    print(f"Connected to MongoDB: {settings.MONGODB_URL}")

async def close_mongo_connection():
    """关闭MongoDB连接"""
    if db.client:
        db.client.close()
        print("Closed MongoDB connection")

async def get_database():
    """获取数据库实例"""
    return db.db
