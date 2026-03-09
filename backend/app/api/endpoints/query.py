from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import pymysql
import logging
import os
from app.core.config import settings
from app.utils.deps import get_current_user
from app.models.user import UserInDB

router = APIRouter()

logger = logging.getLogger(__name__)

class SQLQueryRequest(BaseModel):
    query: str
    database: str = "media_crawler"  # 默认连接到 media_crawler 数据库

class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]

# 数据库连接配置
db_config = {
    "media_crawler": {
        "host": settings.DB_HOST,
        "port": settings.DB_PORT,
        "user": settings.DB_USER,
        "password": settings.DB_PASSWORD,
        "database": os.getenv("DB_NAME", "media_crawler"),  # 从环境变量读取数据库名
        "charset": "utf8mb4",
        "connect_timeout": 5,  # 连接超时时间
        "read_timeout": 30,    # 读取超时时间
        "write_timeout": 30    # 写入超时时间
    }
}

# 打印详细的数据库连接信息
logger.info(f"数据库连接配置: host={settings.DB_HOST}, port={settings.DB_PORT}, user={settings.DB_USER}, database={db_config['media_crawler']['database']}")

# 直接输出到控制台便于调试
print(f"[SQL调试] 数据库连接配置: host={settings.DB_HOST}, port={settings.DB_PORT}, user={settings.DB_USER}, database={db_config['media_crawler']['database']}")



@router.post("/", response_model=QueryResult)
async def execute_sql_query(
    query_request: SQLQueryRequest,
    # u53bbu9664u5f3au5236u8ba4u8bc1u4f9du8d56uff0cu4f7fu5176u5728u672cu5730u5b58u50a8u6a21u5f0fu4e0bu4e5fu80fdu6b63u5e38u5de5u4f5c
    # current_user: UserInDB = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    执行 SQL 查询并返回结果
    """
    # 安全检查：只允许 SELECT 查询
    if not query_request.query.strip().upper().startswith("SELECT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只允许执行 SELECT 查询"
        )
    
    # 获取数据库配置
    db_name = query_request.database
    if db_name not in db_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的数据库: {db_name}"
        )
    
    config = db_config[db_name]
    
    try:
        # 记录查询请求
        logger.info(f"收到SQL查询请求: {query_request.query[:100]}...")
        
        # 尝试连接到数据库，最多重试2次
        connection = None
        retry_count = 0
        max_retries = 2
        last_error = None
        
        while retry_count <= max_retries and connection is None:
            try:
                logger.debug(f"尝试连接到数据库 {db_name}，第 {retry_count + 1} 次尝试")
                connection = pymysql.connect(
                    host=config["host"],
                    port=config["port"],
                    user=config["user"],
                    password=config["password"],
                    database=config["database"],
                    charset=config["charset"],
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=3  # 设置连接超时为3秒
                )
            except pymysql.Error as e:
                last_error = e
                retry_count += 1
                logger.warning(f"连接数据库失败 (尝试 {retry_count}/{max_retries}): {str(e)}")
                if retry_count <= max_retries:
                    import time
                    # 指数退避策略
                    wait_time = 1 * (2 ** (retry_count - 1))  # 1, 2, 4秒
                    logger.info(f"等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
        
        # 如果所有重试都失败，返回空结果
        if connection is None:
            error_msg = f"所有数据库连接尝试均失败: {str(last_error)}"
            logger.error(error_msg)
            
            # 打印详细的连接信息以便调试
            logger.error(f"数据库连接配置: host={config['host']}, port={config['port']}, " 
                       f"user={config['user']}, database={config['database']}")
            
            # 直接输出到控制台便于调试
            print(f"[SQL错误] 数据库连接失败: {str(last_error)}")
            print(f"[SQL错误] 数据库连接配置: host={config['host']}, port={config['port']}, " 
                  f"user={config['user']}, database={config['database']}")

            
            # 检查MySQL服务是否运行
            try:
                import socket
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1)
                result = s.connect_ex((config['host'], config['port']))
                s.close()
                if result == 0:
                    logger.info(f"MySQL服务在{config['host']}:{config['port']}上运行正常")
                else:
                    logger.error(f"MySQL服务在{config['host']}:{config['port']}上无法连接")
            except Exception as e:
                logger.error(f"检查MySQL服务时出错: {str(e)}")
            
            return {"columns": [], "rows": []}
        
        # 设置查询超时
        query_timeout = 10  # 10秒查询超时
        
        try:
            with connection.cursor() as cursor:
                # 记录查询开始
                logger.info(f"开始执行查询: {query_request.query}")
                # 直接输出到控制台便于调试
                print(f"[SQL调试] 开始执行查询: {query_request.query}")
                
                # 检查数据库中是否存在所需表
                try:
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    table_names = [list(table.values())[0] for table in tables]
                    logger.info(f"数据库中的表: {table_names}")
                    print(f"数据库中的表: {table_names}")
                    
                    # 检查查询中提到的表是否存在
                    query_lower = query_request.query.lower()
                    table_mentioned = None
                    for word in query_lower.split():
                        if word in ['from', 'join'] and len(query_lower.split()) > query_lower.split().index(word) + 1:
                            table_mentioned = query_lower.split()[query_lower.split().index(word) + 1].strip(';').strip(',')
                            break
                    
                    if table_mentioned and table_mentioned not in [t.lower() for t in table_names]:
                        logger.warning(f"查询中提到的表 '{table_mentioned}' 在数据库中不存在")
                        print(f"查询中提到的表 '{table_mentioned}' 在数据库中不存在")
                except Exception as e:
                    logger.error(f"检查表时出错: {str(e)}")
                    print(f"检查表时出错: {str(e)}")
                
                try:
                    # 设置查询超时
                    cursor.execute(f"SET SESSION MAX_EXECUTION_TIME={query_timeout * 1000}")
                    
                    # 执行查询
                    logger.info(f"执行SQL: {query_request.query}")
                    print(f"执行SQL: {query_request.query}")
                    cursor.execute(query_request.query)
                    result = cursor.fetchall()
                    
                    # 记录查询结果
                    result_count = len(result)
                    logger.info(f"查询成功，返回 {result_count} 条结果")
                    print(f"查询成功，返回 {result_count} 条结果: {result[:2] if result else '空'}")
                except Exception as e:
                    logger.error(f"执行查询时出错: {str(e)}")
                    print(f"执行查询时出错: {str(e)}")
                    raise
                
                # 如果结果为空
                if not result:
                    # 尝试获取列信息
                    try:
                        # 执行一个查询来获取表结构
                        table_name = None
                        query_lower = query_request.query.lower()
                        for word in query_lower.split():
                            if word in ['from', 'join'] and len(query_lower.split()) > query_lower.split().index(word) + 1:
                                table_name = query_lower.split()[query_lower.split().index(word) + 1].strip(';').strip(',')
                                break
                        
                        if table_name:
                            print(f"尝试获取表 {table_name} 的结构")
                            cursor.execute(f"DESCRIBE {table_name}")
                            table_info = cursor.fetchall()
                            if table_info:
                                # 从表结构中提取列名
                                columns = [col['Field'] for col in table_info]
                                print(f"获取到表结构: {columns}")
                                return {"columns": columns, "rows": []}
                    except Exception as e:
                        print(f"获取表结构时出错: {str(e)}")
                    
                    # 如果无法获取列信息，返回空结果
                    return {"columns": [], "rows": []}
                
                # 提取列名
                columns = list(result[0].keys())
                
                # 提取行数据
                rows = [list(row.values()) for row in result]
                
                # 关闭连接
                connection.close()
                
                return {"columns": columns, "rows": rows}
                
        except pymysql.Error as e:
            logger.error(f"执行查询时出错: {str(e)}")
            # 如果是超时错误
            if "timeout" in str(e).lower():
                logger.warning(f"查询超时 ({query_timeout}秒): {query_request.query[:100]}...")
            
            # 关闭连接
            if connection:
                connection.close()
                
            # 返回空结果
            return {"columns": [], "rows": []}
        
    except pymysql.Error as e:
        logger.error(f"数据库查询错误: {str(e)}")
        # 如果查询出错，返回空结果
        return {"columns": [], "rows": []}
            
    except Exception as e:
        logger.error(f"执行查询时发生错误: {str(e)}")
        # 如果发生其他错误，返回空结果
        return {"columns": [], "rows": []}
    finally:
        if 'connection' in locals() and connection is not None and hasattr(connection, 'open') and connection.open:
            connection.close()
