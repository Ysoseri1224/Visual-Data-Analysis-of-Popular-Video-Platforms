from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"

class LogSource(str, Enum):
    API = "api"
    DATABASE = "database"
    AUTH = "auth"
    SYSTEM = "system"
    ML = "ml"  # 机器学习/NLP处理
    USER = "user"  # 用户操作

class LogEntry(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    timestamp: datetime
    level: LogLevel
    source: LogSource
    message: str
    user_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    class Config:
        schema_extra = {
            "example": {
                "timestamp": "2025-05-22T15:30:45",
                "level": "info",
                "source": "api",
                "message": "用户登录成功",
                "user_id": "60d21b4667d0d8992e610c85",
                "details": {
                    "ip": "192.168.1.1",
                    "user_agent": "Mozilla/5.0..."
                }
            }
        }
        allow_population_by_field_name = True
