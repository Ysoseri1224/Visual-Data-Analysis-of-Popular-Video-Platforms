import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

class Settings(BaseSettings):
    # 基本设置
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "DataAnalysis"
    
    # CORS设置 - 允许所有前端端口
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://localhost:8000", "http://127.0.0.1:8000"]
    
    # 安全设置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-jwt")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # MongoDB设置
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "data_analysis")
    
    # DeepSeek API设置
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "sk-7a57e3ba6a1b48cf9d4ed7e7ea1bbce5")
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/v1/chat/completions"
    
    # MySQL数据库设置
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "123456")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    
    # MySQL安装路径
    MYSQL_PATH: str = os.getenv("MYSQL_PATH", "D:\phpstudy_pro\Extensions\MySQL8.0.12")
    
    class Config:
        case_sensitive = True

settings = Settings()
