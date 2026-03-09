import pandas as pd
import sqlparse
from typing import Dict, List, Any, Optional, Tuple
import json
import logging
import traceback
import aiomysql

from app.db.mongodb import db

# 配置日志
logger = logging.getLogger(__name__)

# MySQL连接配置 - 使用环境变量或默认值
import os

MYSQL_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', '123456'),  # 常用默认密码
    'db': 'media_crawler',  # 固定使用media_crawler数据库
    'charset': 'utf8mb4',
    'autocommit': True  # 自动提交事务
}

async def get_test_data_schema() -> str:
    """
    获取测试数据的模式信息
    
    Returns:
        str: 数据库模式的字符串表示
    """
    schema = """
    表名: test_data
    字段:
    - product_name (文本): 产品名称
    - category (文本): 产品类别
    - price (浮点数): 产品价格
    - stock (整数): 库存数量
    - sales (整数): 销售数量
    - rating (浮点数): 产品评分 (1-5)
    - created_at (日期时间): 创建时间
    """
    return schema

async def execute_sql_query(sql_query: str, database: str = None) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    执行SQL查询并返回结果
    
    Args:
        sql_query: 要执行的SQL查询
        database: 指定的数据库名称（可选）
        
    Returns:
        Tuple[Optional[List[Dict[str, Any]]], Optional[str]]: (查询结果, 错误信息)
    """
    logger.info(f"\n====== 执行 SQL 查询 ======")
    logger.info(f"SQL: {sql_query}")
    logger.info(f"目标数据库: {database if database else 'MongoDB'}")
    
    # 解析SQL查询以确定操作类型
    try:
        parsed = sqlparse.parse(sql_query)[0]
        sql_type = parsed.get_type()
        
        # 目前仅支持SELECT查询
        if sql_type != 'SELECT':
            return None, f"不支持的SQL操作: {sql_type}"
        
        # 确定数据源
        if database and database.lower() == 'media_crawler':
            # 使用MySQL数据库
            return await execute_mysql_query(sql_query)
        else:
            # 默认使用MongoDB
            return await execute_mongodb_query(sql_query)
    
    except Exception as e:
        error_msg = f"查询执行错误: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return None, error_msg


async def execute_mysql_query(sql_query: str) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """执行MySQL查询"""
    logger.info("正在连接MySQL数据库...")
    logger.info(f"MySQL配置: {MYSQL_CONFIG}")
    pool = None
    
    try:
        # 建立MySQL连接
        logger.info("创建MySQL连接池...")
        pool = await aiomysql.create_pool(**MYSQL_CONFIG)
        logger.info("成功创建MySQL连接池")
        
        async with pool.acquire() as conn:
            logger.info("成功获取数据库连接")
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                logger.info(f"开始执行SQL查询: {sql_query}")
                
                # 执行查询
                try:
                    await cursor.execute(sql_query)
                    logger.info("成功执行SQL查询")
                except Exception as sql_error:
                    logger.error(f"SQL执行错误: {str(sql_error)}")
                    raise sql_error
                
                # 获取结果
                results = await cursor.fetchall()
                logger.info(f"查询返回 {len(results)} 行数据")
                
                # 输出前10行数据进行调试
                if results:
                    for i, row in enumerate(results[:3]):
                        logger.info(f"行 {i+1}: {row}")
                
                # 将结果转换为列表字典
                result_list = []
                for row in results:
                    # 处理特殊类型
                    clean_row = {}
                    for key, value in row.items():
                        if isinstance(value, bytes):
                            clean_row[key] = value.decode('utf-8', errors='ignore')
                        elif hasattr(value, 'isoformat'):  # 日期类型
                            clean_row[key] = value.isoformat()
                        else:
                            clean_row[key] = value
                    result_list.append(clean_row)
                
                return result_list, None
    
    except Exception as e:
        error_msg = f"MySQL查询错误: {str(e)}"
        logger.error(error_msg)
        logger.error(f"详细错误追踪: {traceback.format_exc()}")
        return None, error_msg
    
    finally:
        # 确保连接池被关闭
        if pool:
            logger.info("关闭MySQL连接池")
            pool.close()
            await pool.wait_closed()


async def execute_mongodb_query(sql_query: str) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """在MongoDB上执行简化的SQL查询模拟"""
    try:
        # 从 MongoDB 获取测试数据
        cursor = db.db.test_data.find({})
        test_data = []
        async for document in cursor:
            # 转换ObjectId为字符串
            document['_id'] = str(document['_id'])
            test_data.append(document)
        
        # 将数据转换为DataFrame进行处理
        df = pd.DataFrame(test_data)
        if df.empty:
            logger.warning("未从 MongoDB 获取到数据")
            return [], None
        
        # 这里我们使用一个简化的SQL解析和执行逻辑
        # 在实际应用中，你可能需要更复杂的SQL解析器
        
        # 简单的WHERE子句处理
        if 'WHERE' in sql_query.upper():
            where_clause = sql_query.upper().split('WHERE')[1].strip()
            
            # 这里只是一个非常简化的示例
            if 'CATEGORY' in where_clause.upper():
                category = where_clause.split('=')[1].strip().strip("'").strip('"')
                df = df[df['category'] == category]
            elif 'PRICE' in where_clause.upper():
                if '>' in where_clause:
                    price = float(where_clause.split('>')[1].strip())
                    df = df[df['price'] > price]
                elif '<' in where_clause:
                    price = float(where_clause.split('<')[1].strip())
                    df = df[df['price'] < price]
        
        # 简单的ORDER BY处理
        if 'ORDER BY' in sql_query.upper():
            order_clause = sql_query.upper().split('ORDER BY')[1].strip()
            column = order_clause.split()[0].lower()
            if 'DESC' in order_clause.upper():
                df = df.sort_values(by=column, ascending=False)
            else:
                df = df.sort_values(by=column)
        
        # 转换回字典列表
        result = df.to_dict('records')
        logger.info(f"MongoDB查询返回 {len(result)} 行数据")
        return result, None
        
    except Exception as e:
        error_msg = f"MongoDB查询错误: {str(e)}"
        logger.error(error_msg) 
        logger.error(traceback.format_exc())
        return None, error_msg

async def get_visualization_data(query_result: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    准备数据可视化所需的数据
    
    Args:
        query_result: SQL查询的结果
        
    Returns:
        Dict[str, Any]: 可视化数据
    """
    if not query_result:
        return {"error": "没有数据可供可视化"}
    
    # 将结果转换为DataFrame以便处理
    df = pd.DataFrame(query_result)
    
    # 根据数据类型自动选择可视化类型
    visualization_data = {
        "type": "auto",  # 自动、柱状图、折线图、饼图等
        "data": query_result,
        "columns": list(df.columns),
        "summary": {
            "count": len(df),
            "numeric_columns": {}
        }
    }
    
    # 为数值列计算统计摘要
    for column in df.columns:
        if pd.api.types.is_numeric_dtype(df[column]):
            visualization_data["summary"]["numeric_columns"][column] = {
                "min": float(df[column].min()),
                "max": float(df[column].max()),
                "mean": float(df[column].mean()),
                "median": float(df[column].median())
            }
    
    # 推荐可视化类型
    if len(df) > 0:
        numeric_columns = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
        categorical_columns = [col for col in df.columns if col not in numeric_columns]
        
        if len(categorical_columns) >= 1 and len(numeric_columns) >= 1:
            visualization_data["type"] = "bar"  # 有类别和数值，推荐柱状图
        elif len(numeric_columns) >= 2:
            visualization_data["type"] = "scatter"  # 有多个数值列，推荐散点图
        elif len(numeric_columns) == 1 and len(df) <= 10:
            visualization_data["type"] = "pie"  # 只有一个数值列且数据点少，推荐饼图
        elif len(numeric_columns) >= 1:
            visualization_data["type"] = "line"  # 有数值列，推荐折线图
    
    return visualization_data
