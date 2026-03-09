from typing import Optional
from bson import ObjectId

from app.db.mongodb import db
from app.models.user import UserInDB

async def get_user(user_id: str) -> Optional[UserInDB]:
    """
    通过ID获取用户
    """
    if not ObjectId.is_valid(user_id):
        return None
    user = await db.db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        return UserInDB(**user)
    return None

async def get_user_by_email(email: str) -> Optional[UserInDB]:
    """
    通过邮箱获取用户
    """
    user = await db.db.users.find_one({"email": email})
    if user:
        return UserInDB(**user)
    return None

async def get_admin_user(email: str) -> Optional[UserInDB]:
    """
    获取管理员用户
    """
    user = await db.db.users.find_one({"email": email, "role": "admin"})
    if user:
        return UserInDB(**user)
    return None
