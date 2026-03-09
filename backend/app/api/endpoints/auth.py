from datetime import timedelta, datetime
from typing import Any, List, Optional
import json

from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict
from bson import ObjectId
import base64
import re

from app.db.mongodb import db

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.user import UserCreate, UserResponse, UserUpdate
from app.services.user_service import (
    authenticate_user,
    create_user,
    get_user_by_id,
    get_user_by_email,
    update_user,
    authenticate_admin,
    get_all_users,
    update_user_status,
    delete_user,
    update_user_info
)

router = APIRouter()
# 修改tokenUrl为完整的API路径，包含/api/v1前缀
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: str

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception
    
    user = await get_user_by_id(token_data.user_id)
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate) -> Any:
    """
    注册新用户
    """
    try:
        user = await create_user(user_in)
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at,
            "last_login": user.last_login
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """
    用户登录
    """
    # 首先获取用户信息进行初步验证
    user_check = await get_user_by_email(form_data.username)
    if user_check and user_check.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您的账户已被禁用",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 进行完整验证
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码不正确",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/admin/login", response_model=Token)
async def admin_login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """
    管理员登录
    """
    # 首先获取用户信息进行初步验证
    user_check = await get_user_by_email(form_data.username)
    if user_check and user_check.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您的账户已被禁用",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 进行完整验证
    user = await authenticate_admin(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="管理员邮箱或密码不正确，或该用户不是管理员",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user = Depends(get_current_user)) -> Any:
    """
    获取当前用户信息
    """
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    }

@router.get("/admin/me", response_model=UserResponse)
async def read_admin_me(current_user = Depends(get_current_user)) -> Any:
    """
    获取当前管理员信息
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此端点"
        )
        
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    }

@router.put("/update", response_model=UserResponse)
async def update_user_info(
    user_in: UserUpdate,
    current_user = Depends(get_current_user)
) -> Any:
    """
    更新用户信息
    """
    user = await update_user(str(current_user.id), user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at,
        "last_login": user.last_login
    }

@router.get("/admin/users", response_model=List[dict])
async def get_users(current_user = Depends(get_current_user)) -> Any:
    """
    获取所有用户（仅管理员可用）
    """
    # 检查当前用户是否为管理员
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此功能"
        )
    
    users = await get_all_users()
    return [{
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "status": getattr(user, "status", "active")  # 默认为active如果没有设置
    } for user in users]

@router.put("/admin/users/{user_id}/status", response_model=dict)
async def update_user_status_api(
    user_id: str,
    status_data: dict,
    current_user = Depends(get_current_user)
) -> Any:
    """
    更新用户状态（仅管理员可用）
    """
    # 检查当前用户是否为管理员
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此功能"
        )
    
    # 不允许管理员修改自己的状态
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="管理员不能修改自己的状态"
        )
    
    status_value = status_data.get("status")
    if not status_value or status_value not in ["active", "inactive", "banned"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的状态值"
        )
    
    user = await update_user_status(user_id, status_value)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "status": getattr(user, "status", status_value)
    }

class UserUpdateData(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "username": "用户名",
                "email": "user@example.com",
                "role": "user",
                "status": "active"
            }
        }
    )

@router.put("/admin/users/{user_id}", response_model=dict)
async def update_user_api(
    user_id: str,
    user_data: UserUpdateData,
    current_user = Depends(get_current_user)
) -> Any:
    """
    更新用户信息（仅管理员可用）
    """
    # 检查当前用户是否为管理员
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此功能"
        )
    
    # 提取用户数据
    username = user_data.username
    email = user_data.email
    role = user_data.role
    status_value = user_data.status
    
    # 验证状态值
    if status_value and status_value not in ["active", "inactive", "banned"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的状态值"
        )
    
    # 验证角色值
    if role and role not in ["admin", "user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的角色值"
        )
    
    # 记录完整的请求数据，便于调试
    print(f"正在更新用户信息: user_id={user_id}, 数据={user_data.dict()}")
    
    # 更新用户信息
    try:
        # 尝试更新用户信息
        updated_user = await update_user_info(
            user_id=user_id,
            username=username,
            email=email,
            role=role,
            status=status_value
        )
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 返回更新成功的响应
        return {
            "id": str(updated_user.id),
            "username": updated_user.username,
            "email": updated_user.email,
            "role": updated_user.role,
            "status": getattr(updated_user, "status", "active"),
            "message": "用户信息更新成功"
        }
    except ValueError as ve:
        # 处理已知的业务逻辑错误
        print(f"用户更新业务逻辑错误: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        # 处理未预期的错误
        print(f"用户更新未预期错误: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新用户信息失败: {str(e)}"
        )

@router.post("/admin/users/{user_id}/direct-update", response_model=dict)
async def direct_update_user_api(
    user_id: str,
    request: Request,
    current_user = Depends(get_current_user)
) -> Any:
    """
    直接更新用户信息（绝过Pydantic验证）
    """
    # 检查当前用户是否为管理员
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此功能"
        )
    
    try:
        # 直接获取请求体JSON
        user_data = await request.json()
        print(f"直接更新用户，数据: {user_data}")
        
        # 基本的安全检查
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的用户ID"
            )
        
        # 检查用户是否存在
        user_check = await db.db.users.find_one({"_id": ObjectId(user_id)})
        if not user_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 准备更新数据
        update_data = {}
        
        # 可更新字段
        allowed_fields = ["username", "email", "role", "status"]
        
        for field in allowed_fields:
            if field in user_data and user_data[field]:
                # 对特定字段进行简单验证
                if field == "role" and user_data[field] not in ["admin", "user"]:
                    continue
                if field == "status" and user_data[field] not in ["active", "inactive", "banned"]:
                    continue
                    
                update_data[field] = user_data[field]
        
        # 添加更新时间
        update_data["updated_at"] = datetime.utcnow()
        
        # 直接执行数据库更新
        result = await db.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 获取更新后的用户
        updated_user = await db.db.users.find_one({"_id": ObjectId(user_id)})
        
        # 返回响应
        return {
            "id": str(updated_user["_id"]),
            "username": updated_user["username"],
            "email": updated_user["email"],
            "role": updated_user["role"],
            "status": updated_user.get("status", "active"),
            "message": "用户信息更新成功"
        }
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的JSON数据"
        )
    except Exception as e:
        print(f"直接更新用户时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新用户信息失败: {str(e)}"
        )

@router.delete("/admin/users/{user_id}", response_model=dict)
async def delete_user_api(
    user_id: str,
    current_user = Depends(get_current_user)
) -> Any:
    """
    删除用户（仅管理员可用）
    """
    # 检查当前用户是否为管理员
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，只有管理员可以访问此功能"
        )
    
    # 不允许管理员删除自己
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="管理员不能删除自己的账户"
        )
    
    success = await delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在或删除失败"
        )
    
    return {"message": "用户已成功删除"}

@router.post("/upload-avatar", response_model=dict)
async def upload_avatar(
    avatar_data: dict,
    current_user = Depends(get_current_user)
) -> Any:
    """
    上传用户头像
    """
    try:
        # 获取头像数据
        avatar = avatar_data.get("avatar")
        if not avatar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少头像数据"
            )
        
        # 验证Base64格式
        if not avatar.startswith('data:image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="头像格式无效，需要Base64编码的图片"
            )
        
        # 存储头像数据到用户记录
        await db.db.users.update_one(
            {"_id": current_user.id},
            {"$set": {"avatar": avatar}}
        )
        
        return {
            "message": "头像上传成功",
            "avatar": avatar
        }
    except Exception as e:
        print(f"头像上传错误: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"头像上传失败: {str(e)}"
        )

@router.delete("/delete-account", response_model=dict)
async def delete_own_account(
    current_user = Depends(get_current_user)
) -> Any:
    """
    用户自助注销账户
    """
    try:
        user_id = str(current_user.id)
        
        # 删除用户相关的所有数据
        # 1. 删除用户的所有对话
        await db.db.conversations.delete_many({"user_id": user_id})
        
        # 2. 删除用户的所有消息
        await db.db.messages.delete_many({"user_id": user_id})
        
        # 3. 删除用户的所有其他相关数据(如有)
        
        # 4. 最后删除用户账户
        result = await db.db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="账户删除失败"
            )
        
        return {"message": "账户已成功注销"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"注销账户时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"注销账户失败: {str(e)}"
        )
