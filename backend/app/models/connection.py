from typing import Optional, List, Union, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from bson import ObjectId

# 自定义ObjectId字段
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("无效的ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema: Dict[str, Any], field_schema: Dict[str, Any]) -> None:
        field_schema.update(type="string")

# 基础连接模型
class ConnectionBase(BaseModel):
    name: str = Field(..., description="连接名称")
    description: Optional[str] = Field(None, description="连接描述")
    type: Literal["database", "api", "file"] = Field(..., description="连接类型")
    created_by: Optional[str] = Field(None, description="创建者ID")
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

# 数据库连接模型
class DatabaseConnection(ConnectionBase):
    type: Literal["database"] = "database"
    db_type: Literal["mysql", "postgresql", "sqlserver", "oracle", "mongodb"] = Field(..., description="数据库类型")
    host: str = Field(..., description="主机地址")
    port: int = Field(..., description="端口号")
    database: str = Field(..., description="数据库名称")
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")
    ssl: bool = Field(False, description="是否使用SSL")
    connection_string: Optional[str] = Field(None, description="连接字符串(可选)")

# API连接模型
class ApiConnection(ConnectionBase):
    type: Literal["api"] = "api"
    api_type: Literal["rest", "graphql", "soap", "odata"] = Field(..., description="API类型")
    base_url: str = Field(..., description="基础URL")
    auth_type: Literal["none", "api_key", "basic", "bearer", "oauth2"] = Field("none", description="认证类型")
    api_key: Optional[str] = Field(None, description="API密钥")
    api_key_name: Optional[str] = Field(None, description="API密钥名称")
    username: Optional[str] = Field(None, description="用户名(基本认证)")
    password: Optional[str] = Field(None, description="密码(基本认证)")
    bearer_token: Optional[str] = Field(None, description="Bearer令牌")
    headers: Optional[dict] = Field(None, description="自定义请求头")

# 文件服务器连接模型
class FileServerConnection(ConnectionBase):
    type: Literal["file"] = "file"
    file_type: Literal["ftp", "sftp", "s3", "azure_blob", "gcs"] = Field(..., description="文件服务器类型")
    host: Optional[str] = Field(None, description="主机地址(FTP/SFTP)")
    port: Optional[int] = Field(None, description="端口号(FTP/SFTP)")
    username: Optional[str] = Field(None, description="用户名")
    password: Optional[str] = Field(None, description="密码")
    base_path: Optional[str] = Field(None, description="基础路径")
    passive: Optional[bool] = Field(True, description="被动模式(FTP)")
    secure: Optional[bool] = Field(False, description="安全连接")
    access_key: Optional[str] = Field(None, description="访问密钥(云存储)")
    secret_key: Optional[str] = Field(None, description="秘密密钥(云存储)")
    bucket_name: Optional[str] = Field(None, description="存储桶名称(云存储)")

# 连接创建模型
class ConnectionCreate(BaseModel):
    connection: Union[DatabaseConnection, ApiConnection, FileServerConnection]

# 数据库中的连接模型
class ConnectionInDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    description: Optional[str] = None
    type: str
    status: Literal["active", "inactive", "error"] = "inactive"
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: Optional[datetime] = None
    last_tested: Optional[datetime] = None
    config: dict
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

# 连接响应模型
class ConnectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type: str
    status: str
    created_at: datetime
    last_used: Optional[datetime] = None
    config: dict
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

# 连接测试响应
class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None
