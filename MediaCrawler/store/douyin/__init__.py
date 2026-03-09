# 声明：本代码仅供学习和研究目的使用。使用者应遵守以下原则：
# 1. 不得用于任何商业用途。
# 2. 使用时应遵守目标平台的使用条款和robots.txt规则。
# 3. 不得进行大规模爬取或对平台造成运营干扰。
# 4. 应合理控制请求频率，避免给目标平台带来不必要的负担。
# 5. 不得用于任何非法或不当的用途。
#
# 详细许可条款请参阅项目根目录下的LICENSE文件。
# 使用本代码即表示您同意遵守上述原则和LICENSE中的所有条款。


# -*- coding: utf-8 -*-
# @Author  : relakkes@gmail.com
# @Time    : 2024/1/14 18:46
# @Desc    :
from typing import List, Dict
import datetime
import re

import config
from tools import utils
from var import source_keyword_var

from .douyin_store_impl import *


def clean_text(text):
    """
    彻底清理文本中的所有特殊字符和emoji，只保留汉字、英文字母、数字和基本标点
    Args:
        text: 输入文本
    Returns:
        清理后的文本
    """
    if not text:
        return ""
    
    # 定义允许的字符范围：汉字、英文字母、数字和基本标点
    # 汉字范围：\u4e00-\u9fa5
    # 英文字母：a-zA-Z
    # 数字：0-9
    # 基本标点：空格、逗号、句号、问号、感叹号、括号、连字符
    allowed_pattern = re.compile(r'[\u4e00-\u9fa5a-zA-Z0-9\s.,!?()\-]+')
    
    # 提取符合模式的字符
    filtered_chars = allowed_pattern.findall(text)
    
    # 将提取的字符重新组合成字符串
    result = ''.join(filtered_chars)
    
    utils.logger.info(f"[clean_text] Original: {text} -> Cleaned: {result}")
    
    return result


class DouyinStoreFactory:
    STORES = {
        "csv": DouyinCsvStoreImplement,
        "db": DouyinDbStoreImplement,
        "json": DouyinJsonStoreImplement,
    }

    @staticmethod
    def create_store() -> AbstractStore:
        store_class = DouyinStoreFactory.STORES.get(config.SAVE_DATA_OPTION)
        if not store_class:
            raise ValueError(
                "[DouyinStoreFactory.create_store] Invalid save option only supported csv or db or json ..."
            )
        return store_class()


def _extract_comment_image_list(comment_item: Dict) -> List[str]:
    """
    提取评论图片列表

    Args:
        comment_item (Dict): 抖音评论

    Returns:
        List[str]: 评论图片列表
    """
    images_res: List[str] = []
    image_list: List[Dict] = comment_item.get("image_list", [])

    if not image_list:
        return []

    for image in image_list:
        image_url_list = image.get("origin_url", {}).get("url_list", [])
        if image_url_list and len(image_url_list) > 1:
            images_res.append(image_url_list[1])

    return images_res


async def update_douyin_aweme(aweme_item: Dict):
    aweme_id = aweme_item.get("aweme_id")
    user_info = aweme_item.get("author", {})
    interact_info = aweme_item.get("statistics", {})
    
    # 将时间戳转换为日期字符串
    create_time = aweme_item.get("create_time", 0)
    date_str = ""
    if create_time > 0:
        date_str = datetime.datetime.fromtimestamp(create_time).strftime('%Y-%m-%d')
        
    # 清理所有文本字段
    desc = aweme_item.get("desc", "")
    cleaned_desc = clean_text(desc)
    cleaned_user_signature = clean_text(user_info.get("signature", ""))
    cleaned_nickname = clean_text(user_info.get("nickname", ""))
    cleaned_avatar = clean_text(user_info.get("avatar_thumb", {}).get("url_list", [""])[0])
    cleaned_user_unique_id = clean_text(user_info.get("unique_id", ""))
    
    save_content_item = {
        "aweme_id": aweme_id,
        "aweme_type": str(aweme_item.get("aweme_type")),
        "title": cleaned_desc,  # 使用清理后的标题
        "desc": cleaned_desc,  # 使用清理后的描述
        "create_time": create_time,
        "date": date_str, # 新增日期字段
        "user_id": user_info.get("uid"),
        "sec_uid": user_info.get("sec_uid"),
        "short_user_id": user_info.get("short_id"),
        "user_unique_id": cleaned_user_unique_id,  # 使用清理后的用户ID
        "user_signature": cleaned_user_signature,  # 使用清理后的签名
        "nickname": cleaned_nickname,  # 使用清理后的昵称
        "avatar": cleaned_avatar,  # 使用清理后的头像地址
        "liked_count": str(interact_info.get("digg_count")),
        "collected_count": str(interact_info.get("collect_count")),
        "comment_count": str(interact_info.get("comment_count")),
        "share_count": str(interact_info.get("share_count")),
        "ip_location": aweme_item.get("ip_label", ""),
        "last_modify_ts": utils.get_current_timestamp(),
        "aweme_url": f"https://www.douyin.com/video/{aweme_id}",
        "source_keyword": source_keyword_var.get(),
    }
    utils.logger.info(
        f"[store.douyin.update_douyin_aweme] douyin aweme id:{aweme_id}, title:{save_content_item.get('title')}"
    )
    await DouyinStoreFactory.create_store().store_content(
        content_item=save_content_item
    )


async def batch_update_dy_aweme_comments(aweme_id: str, comments: List[Dict]):
    if not comments:
        return
    for comment_item in comments:
        await update_dy_aweme_comment(aweme_id, comment_item)


async def update_dy_aweme_comment(aweme_id: str, comment_item: Dict):
    comment_aweme_id = comment_item.get("aweme_id")
    if aweme_id != comment_aweme_id:
        utils.logger.error(
            f"[store.douyin.update_dy_aweme_comment] comment_aweme_id: {comment_aweme_id} != aweme_id: {aweme_id}"
        )
        return
    user_info = comment_item.get("user", {})
    comment_id = comment_item.get("cid")
    parent_comment_id = comment_item.get("reply_id", "0")
    avatar_info = (
        user_info.get("avatar_medium", {})
        or user_info.get("avatar_300x300", {})
        or user_info.get("avatar_168x168", {})
        or user_info.get("avatar_thumb", {})
        or {}
    )
    # 清理评论相关的所有文本字段
    cleaned_content = clean_text(comment_item.get("text", ""))
    cleaned_ip_location = clean_text(comment_item.get("ip_label", ""))
    cleaned_user_unique_id = clean_text(user_info.get("unique_id", ""))
    cleaned_user_signature = clean_text(user_info.get("signature", ""))
    cleaned_nickname = clean_text(user_info.get("nickname", ""))
    cleaned_avatar = clean_text(avatar_info.get("url_list", [""])[0])
    
    # 清理图片列表
    image_list = _extract_comment_image_list(comment_item)
    cleaned_pictures = ",".join([clean_text(img) for img in image_list])
    
    save_comment_item = {
        "comment_id": comment_id,
        "create_time": comment_item.get("create_time"),
        "ip_location": cleaned_ip_location,  # 使用清理后的IP地址
        "aweme_id": aweme_id,
        "content": cleaned_content,  # 使用清理后的评论内容
        "user_id": user_info.get("uid"),
        "sec_uid": user_info.get("sec_uid"),
        "short_user_id": user_info.get("short_id"),
        "user_unique_id": cleaned_user_unique_id,  # 使用清理后的用户ID
        "user_signature": cleaned_user_signature,  # 使用清理后的签名
        "nickname": cleaned_nickname,  # 使用清理后的昵称
        "avatar": cleaned_avatar,  # 使用清理后的头像地址
        "sub_comment_count": str(comment_item.get("reply_comment_total", 0)),
        "like_count": (
            comment_item.get("digg_count") if comment_item.get("digg_count") else 0
        ),
        "last_modify_ts": utils.get_current_timestamp(),
        "parent_comment_id": parent_comment_id,
        "pictures": cleaned_pictures,  # 使用清理后的图片地址
    }
    utils.logger.info(
        f"[store.douyin.update_dy_aweme_comment] douyin aweme comment: {comment_id}, content: {save_comment_item.get('content')}"
    )

    await DouyinStoreFactory.create_store().store_comment(
        comment_item=save_comment_item
    )


async def save_creator(user_id: str, creator: Dict):
    user_info = creator.get("user", {})
    gender_map = {0: "未知", 1: "男", 2: "女"}
    avatar_uri = user_info.get("avatar_300x300", {}).get("uri")
    
    # 清理所有文本字段
    cleaned_nickname = clean_text(user_info.get("nickname", ""))
    cleaned_desc = clean_text(user_info.get("signature", ""))
    cleaned_ip_location = clean_text(user_info.get("ip_location", ""))
    
    # 清理头像URL
    avatar_url = f"https://p3-pc.douyinpic.com/img/{avatar_uri}~c5_300x300.jpeg?from=2956013662"
    cleaned_avatar = clean_text(avatar_url)
    
    local_db_item = {
        "user_id": user_id,
        "nickname": cleaned_nickname,  # 使用清理后的昵称
        "gender": gender_map.get(user_info.get("gender"), "未知"),
        "avatar": cleaned_avatar,  # 使用清理后的头像URL
        "desc": cleaned_desc,  # 使用清理后的个人描述
        "ip_location": cleaned_ip_location,  # 使用清理后的IP地址
        "follows": user_info.get("following_count", 0),
        "fans": user_info.get("max_follower_count", 0),
        "interaction": user_info.get("total_favorited", 0),
        "videos_count": user_info.get("aweme_count", 0),
        "last_modify_ts": utils.get_current_timestamp(),
    }
    utils.logger.info(f"[store.douyin.save_creator] creator:{local_db_item}")
    await DouyinStoreFactory.create_store().store_creator(local_db_item)
