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
# @Time    : 2024/4/5 09:43
# @Desc    : 快代理HTTP实现，官方文档：https://www.kuaidaili.com/?ref=ldwkjqipvz6c
import os
import re
import time
from typing import Dict, List

import httpx
from pydantic import BaseModel, Field

from proxy import IpCache, IpInfoModel, ProxyProvider
from proxy.types import ProviderNameEnum
from tools import utils


class KuaidailiProxyModel(BaseModel):
    ip: str = Field("ip")
    port: int = Field("端口")
    expire_ts: int = Field("过期时间")


def parse_kuaidaili_proxy(proxy_info: str) -> KuaidailiProxyModel:
    """
    解析快代理的IP信息
    Args:
        proxy_info:

    Returns:

    """
    proxies: List[str] = proxy_info.split(":")
    if len(proxies) != 2:
        raise Exception("not invalid kuaidaili proxy info")

    pattern = r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5}),(\d+)'
    match = re.search(pattern, proxy_info)
    if not match.groups():
        raise Exception("not match kuaidaili proxy info")

    return KuaidailiProxyModel(
        ip=match.groups()[0],
        port=int(match.groups()[1]),
        expire_ts=int(match.groups()[2])
    )


class KuaiDaiLiProxy(ProxyProvider):
    def __init__(self, kdl_user_name: str, kdl_user_pwd: str, kdl_secret_id: str, kdl_secret_key: str):
        """

        Args:
            kdl_user_name: 快代理用户名
            kdl_user_pwd: 快代理密码
            kdl_secret_id: 快代理secret_id
            kdl_secret_key: 快代理secret_key
        """
        self.kdl_user_name = kdl_user_name
        self.kdl_user_pwd = kdl_user_pwd
        self.api_base = "https://dps.kdlapi.com/"
        self.auth_base = "https://auth.kdlapi.com/"
        self.secret_id = kdl_secret_id
        self.secret_key = kdl_secret_key
        self.ip_cache = IpCache()
        self.proxy_brand_name = ProviderNameEnum.KUAI_DAILI_PROVIDER.value
        self.secret_token = None
        self.token_expire_time = 0
        
    async def get_secret_token(self) -> str:
        """
        获取快代理API密钥令牌
        Returns: secret_token
        """
        # 检查是否已有有效的令牌
        current_time = int(time.time())
        if self.secret_token and current_time < self.token_expire_time - 300:  # 提前5分钟更新令牌
            return self.secret_token
            
        auth_url = self.auth_base + "/api/get_secret_token"
        data = {
            "secret_id": self.secret_id,
            "secret_key": self.secret_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(auth_url, data=data)
            if response.status_code != 200:
                utils.logger.error(f"获取密钥令牌失败，状态码: {response.status_code}, 响应: {response.text}")
                raise Exception(f"获取密钥令牌失败: {response.text}")
                
            result = response.json()
            if result.get("code") != 0:
                utils.logger.error(f"获取密钥令牌失败: {result.get('msg')}")
                raise Exception(f"获取密钥令牌失败: {result.get('msg')}")
            
            self.secret_token = result["data"]["secret_token"]
            self.token_expire_time = current_time + result["data"]["expire"]
            return self.secret_token

    async def get_proxies(self, num: int) -> List[IpInfoModel]:
        """
        快代理实现 - 使用手动提取的IP列表
        Args:
            num: 需要的代理IP数量

        Returns: 代理IP列表
        """
        # 优先从缓存中拿 IP
        ip_cache_list = self.ip_cache.load_all_ip(proxy_brand_name=self.proxy_brand_name)
        if len(ip_cache_list) >= num:
            return ip_cache_list[:num]

        # 手动提取的IP列表 - 2025-05-26更新
        hard_coded_proxies = [
            "182.106.136.217:40765",
            "36.151.192.236:41341",
            "58.19.54.132:41153",
            "106.122.201.203:23590",
            "58.19.54.5:23822",
            "61.184.8.27:21107",
            "58.19.55.9:34570",
            "218.95.37.135:20987",
            "58.19.55.11:14191",
            "58.19.55.11:13162",
            "61.184.8.27:40839",
            "183.165.244.235:21286",
            "61.184.8.27:41247",
            "218.95.37.135:41473",
            "61.184.8.27:40628",
            "36.151.192.236:41653",
            "58.19.54.132:40032",
            "36.151.192.236:41677",
            "182.106.136.217:40327",
            "58.19.54.132:40266"
        ]
        
        # 计算需要的代理数量
        need_get_count = min(num - len(ip_cache_list), len(hard_coded_proxies))
        
        ip_infos: List[IpInfoModel] = []
        try:
            # 使用硬编码的代理IP列表
            for i in range(need_get_count):
                proxy = hard_coded_proxies[i]
                ip, port_str = proxy.split(":")
                port = int(port_str)
                
                # 设置过期时间为24小时后
                expire_ts = int(time.time()) + 86400
                
                ip_info_model = IpInfoModel(
                    ip=ip,
                    port=port,
                    user=self.kdl_user_name,
                    password=self.kdl_user_pwd,
                    expired_time_ts=expire_ts,
                )
                
                ip_key = f"{self.proxy_brand_name}_{ip_info_model.ip}_{ip_info_model.port}"
                self.ip_cache.set_ip(ip_key, ip_info_model.model_dump_json(), ex=ip_info_model.expired_time_ts)
                ip_infos.append(ip_info_model)
                
            utils.logger.info(f"[KuaiDaiLiProxy.get_proxies] 成功获取 {len(ip_infos)} 个硬编码代理IP")
            
        except Exception as e:
            utils.logger.error(f"[KuaiDaiLiProxy.get_proxies] 处理硬编码代理IP时出错: {str(e)}")
            raise e

        return ip_cache_list + ip_infos


def new_kuai_daili_proxy() -> KuaiDaiLiProxy:
    """
    构造快代理HTTP实例
    Returns:

    """
    return KuaiDaiLiProxy(
        kdl_secret_id=os.getenv("kdl_secret_id", "u8yf9jd61wbdclu5k3mx"),
        kdl_secret_key=os.getenv("kdl_secret_key", "vtyqht90p4rsbipqevbypntgrj38raw2"),  # 改名为kdl_secret_key
        kdl_user_name=os.getenv("kdl_user_name", "d3472621674"),
        kdl_user_pwd=os.getenv("kdl_user_pwd", "h51locr7"),
    )
