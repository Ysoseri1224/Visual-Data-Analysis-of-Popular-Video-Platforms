from fastapi import APIRouter

from app.api.endpoints import auth, conversations, data, connections, query, health, websocket, chat, visual, schema, visualization, memory, settings, monitoring, logs

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["对话"])
api_router.include_router(data.router, prefix="/data", tags=["数据"])
api_router.include_router(connections.router, prefix="/connections", tags=["数据连接"])
api_router.include_router(query.router, prefix="/query", tags=["数据查询"])
api_router.include_router(health.router, prefix="/health", tags=["系统健康"])
api_router.include_router(websocket.router, tags=["WebSocket"])
api_router.include_router(chat.router, prefix="/AIchat", tags=["聊天"])
api_router.include_router(visual.router, prefix="/visual", tags=["数据可视化"])
api_router.include_router(schema.router, prefix="/schema", tags=["数据库结构"])
api_router.include_router(visualization.router, prefix="/visualization", tags=["图表生成"])
api_router.include_router(memory.router, prefix="/memory", tags=["记忆库管理"])
api_router.include_router(settings.router, prefix="/settings", tags=["系统设置"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["系统监控"])
api_router.include_router(logs.router, prefix="/logs", tags=["日志管理"])
