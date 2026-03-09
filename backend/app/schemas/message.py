from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MessageBase(BaseModel):
    """
    消息基础模型
    """
    content: str
    role: str = "user"  # user 或 assistant
    conversation_id: Optional[str] = None

class MessageCreate(MessageBase):
    """
    创建消息的请求模型
    """
    pass

class MessageResponse(MessageBase):
    """
    消息响应模型
    """
    id: str
    created_at: datetime
    
    class Config:
        populate_by_name = True

class ConversationBase(BaseModel):
    """
    对话基础模型
    """
    title: str
    user_id: str

class ConversationCreate(ConversationBase):
    """
    创建对话的请求模型
    """
    pass

class ConversationUpdate(BaseModel):
    """
    更新对话的请求模型
    """
    title: Optional[str] = None

class ConversationResponse(ConversationBase):
    """
    对话响应模型
    """
    id: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    
    class Config:
        populate_by_name = True
