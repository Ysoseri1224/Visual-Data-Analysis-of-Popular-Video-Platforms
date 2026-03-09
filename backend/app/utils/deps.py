from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.models.user import UserInDB
from app.services.user_service import get_user_by_id

class TokenData(BaseModel):
    user_id: str

# 用于从Authorization头中提取Bearer令牌的安全依赖项
security = HTTPBearer(auto_error=False)

async def get_current_user(authorization: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> UserInDB:
    """
    获取当前用户
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 检查是否有Authorization头
    if authorization is None:
        raise credentials_exception
    
    # 从Authorization头中提取令牌
    token = authorization.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError as e:
        print(f"JWT解码错误: {str(e)}")
        raise credentials_exception
    
    user = await get_user_by_id(token_data.user_id)
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_admin(current_user: UserInDB = Depends(get_current_user)) -> UserInDB:
    """
    获取当前管理员用户
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )
    
    return current_user
