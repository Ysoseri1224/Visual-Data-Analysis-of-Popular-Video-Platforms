import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.api import api_router
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.db.init_db import init_db

app = FastAPI(
    title="DataAnalysis API",
    description="数据分析智能对话平台 API",
    version="0.1.0",
)

# 设置CORS - 增强版配置
# 完善的CORS配置，允许所有必要的请求头和方法
# 开发环境下可以使用'*'来简化配置
# 生产环境应该限制为特定域名

# 设置允许的源 - 开发环境下允许所有源
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    # 添加更多端口和域名
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    # 开发环境下可以使用通配符，生产环境应该移除
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 明确指定允许的源，而不是使用通配符
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有请求头
    expose_headers=["*"],  # 暴露所有响应头
    max_age=600,  # 预检请求缓存时间
)

# 包含所有API路由
app.include_router(api_router, prefix="/api/v1")

# 启动事件
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    await init_db()

# 关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

if __name__ == "__main__":
    # 使用 0.0.0.0 绑定所有网络接口，解决连接问题
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
