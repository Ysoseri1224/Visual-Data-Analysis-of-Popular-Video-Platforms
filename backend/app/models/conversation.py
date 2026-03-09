from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, info=None):
        if not ObjectId.is_valid(v):
            raise ValueError("无效的ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema: Dict[str, Any], field_schema: Dict[str, Any]) -> None:
        field_schema.update(type="string")

class Message(BaseModel):
    role: str  # user 或 system
    message: str
    content: Optional[str] = None  # 兼容性字段，与message相同
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    model_type: Optional[str] = None  # 添加模型类型字段，如't5'或'deepseek'
    natural_language: Optional[str] = None  # 原始自然语言问题
    sql_query: Optional[str] = None  # SQL查询字段
    visualization_type: Optional[str] = None  # 可视化类型
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class ConversationBase(BaseModel):
    title: str
    user_id: PyObjectId

class ConversationCreate(ConversationBase):
    pass

class ConversationUpdate(BaseModel):
    title: Optional[str] = None

class ConversationInDB(ConversationBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Message] = []
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class ConversationResponse(BaseModel):
    id: str
    title: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    messages: List[Message]
    
    model_config = ConfigDict(
        populate_by_name=True
    )
