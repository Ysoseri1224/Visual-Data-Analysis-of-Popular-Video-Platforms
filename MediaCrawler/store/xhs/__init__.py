# 声明：本代码仅供学习和研究目的使用。使用者应遵守以下原则：  
# 1. 不得用于任何商业用途。  
# 2. 使用时应遵守目标平台的使用条款和robots.txt规则。  
# 3. 不得进行大规模爬取或对平台造成运营干扰。  
# 4. 应合理控制请求频率，避免给目标平台带来不必要的负担。   
# 5. 不得用于任何非法或不当的用途.
#   
# 详细许可条款请参阅项目根目录下的LICENSE文件。  
# 使用本代码即表示您同意遵守上述原则和LICENSE中的所有条款。  


# -*- coding: utf-8 -*-
# @Author  : relakkes@gmail.com
# @Time    : 2024/1/14 17:34
# @Desc    :
from typing import List, Dict
import datetime
import re
import config
from var import source_keyword_var
from tools import utils

from . import xhs_store_impl
from .xhs_store_image import *
from .xhs_store_impl import *


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


class XhsStoreFactory:
    STORES = {
        "csv": XhsCsvStoreImplement,
        "db": XhsDbStoreImplement,
        "json": XhsJsonStoreImplement
    }

    @staticmethod
    def create_store() -> AbstractStore:
        store_class = XhsStoreFactory.STORES.get(config.SAVE_DATA_OPTION)
        if not store_class:
            raise ValueError("[XhsStoreFactory.create_store] Invalid save option only supported csv or db or json ...")
        return store_class()


def get_video_url_arr(note_item: Dict) -> List:
    """
    获取视频url数组
    Args:
        note_item:

    Returns:

    """
    if note_item.get('type') != 'video':
        return []

    videoArr = []
    originVideoKey = note_item.get('video').get('consumer').get('origin_video_key')
    if originVideoKey == '':
        originVideoKey = note_item.get('video').get('consumer').get('originVideoKey')
    # 降级有水印
    if originVideoKey == '':
        videos = note_item.get('video').get('media').get('stream').get('h264')
        if type(videos).__name__ == 'list':
            videoArr = [v.get('master_url') for v in videos]
    else:
        videoArr = [f"http://sns-video-bd.xhscdn.com/{originVideoKey}"]

    return videoArr


async def update_xhs_note(note_item: Dict):
    """
    更新小红书笔记
    Args:
        note_item:

    Returns:

    """
    note_id = note_item.get("note_id")
    user_info = note_item.get("user", {})
    interact_info = note_item.get("interact_info", {})
    image_list: List[Dict] = note_item.get("image_list", [])
    tag_list: List[Dict] = note_item.get("tag_list", [])

    for img in image_list:
        if img.get('url_default') != '':
            img.update({'url': img.get('url_default')})

    video_url = ','.join(get_video_url_arr(note_item))
    
    # 将时间戳转换为日期字符串
    time_stamp = note_item.get("time", 0)
    date_str = ""
    try:
        # 处理毫秒级时间戳(13位)
        if time_stamp > 0:
            if len(str(time_stamp)) > 10:
                # 毫秒级时间戳转换为秒级
                time_stamp = time_stamp / 1000
            date_str = datetime.datetime.fromtimestamp(time_stamp).strftime('%Y-%m-%d')
    except (OSError, ValueError, TypeError) as e:
        # 如果时间戳无效，使用当前日期
        utils.logger.error(f"[store.xhs.update_xhs_note] Invalid timestamp: {time_stamp}, error: {e}")
        date_str = datetime.datetime.now().strftime('%Y-%m-%d')

    # 清理所有文本字段中的emoji和特殊字符
    title = note_item.get("title") or note_item.get("desc", "")[:255]
    desc = note_item.get("desc", "")
    nickname = user_info.get("nickname", "")
    
    cleaned_title = clean_text(title)
    cleaned_desc = clean_text(desc)
    cleaned_nickname = clean_text(nickname)
    
    utils.logger.info(f"[store.xhs.update_xhs_note] Cleaned title: {title} -> {cleaned_title}")
    utils.logger.info(f"[store.xhs.update_xhs_note] Cleaned nickname: {nickname} -> {cleaned_nickname}")
    
    # 清理所有要存入数据库的文本字段
    cleaned_ip_location = clean_text(note_item.get("ip_location", ""))
    cleaned_image_list = ','.join([clean_text(img.get('url', '')) for img in image_list])
    cleaned_tag_list = ','.join([clean_text(tag.get('name', '')) for tag in tag_list if tag.get('type') == 'topic'])
    cleaned_source_keyword = clean_text(source_keyword_var.get())
    
    local_db_item = {
        "note_id": note_item.get("note_id"), # 帖子id
        "type": note_item.get("type"), # 帖子类型
        "title": cleaned_title, # 帖子标题
        "desc": cleaned_desc, # 帖子描述
        "video_url": clean_text(video_url), # 帖子视频url
        "time": note_item.get("time"), # 帖子发布时间
        "date": date_str, # 帖子发布日期（新增字段）
        "last_update_time": note_item.get("last_update_time", 0), # 帖子最后更新时间
        "user_id": user_info.get("user_id"), # 用户id
        "nickname": cleaned_nickname, # 用户昵称 - 使用清理后的昵称
        "avatar": clean_text(user_info.get("avatar", "")), # 用户头像
        "liked_count": interact_info.get("liked_count"), # 点赞数
        "collected_count": interact_info.get("collected_count"), # 收藏数
        "comment_count": interact_info.get("comment_count"), # 评论数
        "share_count": interact_info.get("share_count"), # 分享数
        "ip_location": cleaned_ip_location, # ip地址
        "image_list": cleaned_image_list, # 图片url
        "tag_list": cleaned_tag_list, # 标签
        "last_modify_ts": utils.get_current_timestamp(), # 最后更新时间戳（MediaCrawler程序生成的，主要用途在db存储的时候记录一条记录最新更新时间）
        "note_url": f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={note_item.get('xsec_token')}&xsec_source=pc_search", # 帖子url
        "source_keyword": cleaned_source_keyword, # 搜索关键词
        "xsec_token": note_item.get("xsec_token"), # xsec_token
    }
    utils.logger.info(f"[store.xhs.update_xhs_note] xhs note: {local_db_item}")
    await XhsStoreFactory.create_store().store_content(local_db_item)


async def batch_update_xhs_note_comments(note_id: str, comments: List[Dict]):
    """
    批量更新小红书笔记评论
    Args:
        note_id:
        comments:

    Returns:

    """
    if not comments:
        return
    for comment_item in comments:
        await update_xhs_note_comment(note_id, comment_item)


async def update_xhs_note_comment(note_id: str, comment_item: Dict):
    """
    更新小红书笔记评论
    Args:
        note_id:
        comment_item:

    Returns:

    """
    user_info = comment_item.get("user_info", {})
    comment_id = comment_item.get("id")
    comment_pictures = [item.get("url_default", "") for item in comment_item.get("pictures", [])]
    target_comment = comment_item.get("target_comment", {})
    # 清理所有要存入数据库的评论相关文本字段
    cleaned_content = clean_text(comment_item.get("content", ""))
    cleaned_nickname = clean_text(user_info.get("nickname", ""))
    cleaned_ip_location = clean_text(comment_item.get("ip_location", ""))
    cleaned_pictures = ",".join([clean_text(pic) for pic in comment_pictures])
    
    local_db_item = {
        "comment_id": comment_id, # 评论 id
        "create_time": comment_item.get("create_time"), # 评论时间
        "ip_location": cleaned_ip_location, # ip地址
        "note_id": note_id, # 帖子id
        "content": cleaned_content, # 评论内容 - 使用清理后的内容
        "user_id": user_info.get("user_id"), # 用户id
        "nickname": cleaned_nickname, # 用户昵称 - 使用清理后的昵称
        "avatar": clean_text(user_info.get("image", "")), # 用户头像
        "sub_comment_count": comment_item.get("sub_comment_count", 0), # 子评论数
        "pictures": cleaned_pictures, # 评论图片
        "parent_comment_id": target_comment.get("id", 0), # 父评论 id
        "last_modify_ts": utils.get_current_timestamp(), # 最后更新时间戳（MediaCrawler程序生成的，主要用途在db存储的时候记录一条记录最新更新时间）
        "like_count": comment_item.get("like_count", 0),
    }
    utils.logger.info(f"[store.xhs.update_xhs_note_comment] xhs note comment:{local_db_item}")
    await XhsStoreFactory.create_store().store_comment(local_db_item)


async def save_creator(user_id: str, creator: Dict):
    """
    保存小红书创作者
    Args:
        user_id:
        creator:

    Returns:

    """
    user_info = creator.get('basicInfo', {})

    follows = 0
    fans = 0
    interaction = 0
    for i in creator.get('interactions'):
        if i.get('type') == 'follows':
            follows = i.get('count')
        elif i.get('type') == 'fans':
            fans = i.get('count')
        elif i.get('type') == 'interaction':
            interaction = i.get('count')

    def get_gender(gender):
        if gender == 1:
            return '女'
        elif gender == 0:
            return '男'
        else:
            return None

    # 清理创作者信息的文本字段
    cleaned_nickname = clean_text(user_info.get('nickname', ''))
    cleaned_avatar = clean_text(user_info.get('images', ''))
    cleaned_desc = clean_text(user_info.get('desc', ''))
    cleaned_ip_location = clean_text(user_info.get('ipLocation', ''))
    
    # 清理标签列表
    cleaned_tags = {}
    for tag in creator.get('tags', []):
        tag_type = clean_text(tag.get('tagType', ''))
        tag_name = clean_text(tag.get('name', ''))
        cleaned_tags[tag_type] = tag_name
    
    local_db_item = {
        'user_id': user_id,  # 用户id
        'nickname': cleaned_nickname,  # 昵称 - 使用清理后的昵称
        'gender':  get_gender(user_info.get('gender')), # 性别
        'avatar': cleaned_avatar, # 头像
        'desc': cleaned_desc, # 个人描述
        'ip_location': cleaned_ip_location, # ip地址
        'follows': follows, # 关注数
        'fans': fans,  # 粉丝数
        'interaction': interaction, # 互动数
        'tag_list': json.dumps(cleaned_tags, ensure_ascii=False), # 标签
        "last_modify_ts": utils.get_current_timestamp(), # 最后更新时间戳（MediaCrawler程序生成的，主要用途在db存储的时候记录一条记录最新更新时间）
    }
    utils.logger.info(f"[store.xhs.save_creator] creator:{local_db_item}")
    await XhsStoreFactory.create_store().store_creator(local_db_item)


async def update_xhs_note_image(note_id, pic_content, extension_file_name):
    """
    更新小红书笔
    Args:
        note_id:
        pic_content:
        extension_file_name:

    Returns:

    """

    await XiaoHongShuImage().store_image(
        {"notice_id": note_id, "pic_content": pic_content, "extension_file_name": extension_file_name})
