# 声明：本代码仅供学习和研究目的使用。使用者应遵守以下原则：  
# 1. 不得用于任何商业用途。  
# 2. 使用时应遵守目标平台的使用条款和robots.txt规则。  
# 3. 不得进行大规模爬取或对平台造成运营干扰。  
# 4. 应合理控制请求频率，避免给目标平台带来不必要的负担。   
# 5. 不得用于任何非法或不当的用途。
#   
# 详细许可条款请参阅项目根目录下的LICENSE文件。  
# 使用本代码即表示您同意遵守上述原则和LICENSE中的所有条款。  

import os
from abc import ABC, abstractmethod
from typing import Dict, Optional

from playwright.async_api import BrowserContext, BrowserType


class AbstractCrawler(ABC):
    @abstractmethod
    async def start(self):
        """
        start crawler
        """
        pass

    @abstractmethod
    async def search(self):
        """
        search
        """
        pass

    @abstractmethod
    async def launch_browser(
        self,
        browser_type: BrowserType,  # 将chromium改为通用的browser_type
        playwright_proxy: Optional[Dict],
        user_agent: Optional[str],
        headless: bool = True,
        firefox_specific: bool = False
    ) -> BrowserContext:
        """Launch browser and create browser context"""
        if config.SAVE_LOGIN_STATE:
            user_data_dir = os.path.join(os.getcwd(), "browser_data",
                                         config.USER_DATA_DIR % config.PLATFORM)  # type: ignore
            
            # 添加Firefox特有的启动参数
            launch_options = {
                "user_data_dir": user_data_dir,
                "accept_downloads": True,
                "headless": headless,
                "proxy": playwright_proxy,  # type: ignore
                "viewport": {"width": 1920, "height": 1080},
                "user_agent": user_agent
            }
            
            # 如果是Firefox，添加特有配置
            if firefox_specific:
                # Firefox特有的配置
                firefox_args = [
                    "-no-remote",  # 允许同时运行多个Firefox实例
                    "-foreground",  # 保持在前台运行
                    "-no-xshm",  # 禁用X共享内存扩展
                    "--disable-extensions"  # 禁用扩展
                ]
                launch_options["firefox_user_prefs"] = {
                    "network.proxy.type": 1,  # 手动代理配置
                    "network.proxy.socks_remote_dns": True,  # 通过代理解析DNS
                    "network.proxy.no_proxies_on": "localhost,127.0.0.1",  # 不代理本地连接
                    "media.peerconnection.enabled": False,  # 禁用WebRTC (防止IP泄露)
                    "privacy.resistFingerprinting": True,  # 抵抗指纹识别
                }
                launch_options["args"] = firefox_args
                
            browser_context = await browser_type.launch_persistent_context(**launch_options)  # type: ignore
            return browser_context
        else:
            # 非持久化会话的浏览器启动选项
            launch_options = {
                "headless": headless, 
                "proxy": playwright_proxy  # type: ignore
            }
            
            # 为Firefox添加特有参数
            if firefox_specific:
                firefox_args = [
                    "-no-remote",
                    "-foreground",
                    "-no-xshm",
                    "--disable-extensions"
                ]
                launch_options["firefox_user_prefs"] = {
                    "network.proxy.type": 1,
                    "network.proxy.socks_remote_dns": True,
                    "network.proxy.no_proxies_on": "localhost,127.0.0.1",
                    "media.peerconnection.enabled": False,
                    "privacy.resistFingerprinting": True,
                }
                launch_options["args"] = firefox_args
            
            browser = await browser_type.launch(**launch_options)
            
            # 创建新的浏览器上下文
            context_options = {
                "viewport": {"width": 1920, "height": 1080},
                "user_agent": user_agent
            }
            browser_context = await browser.new_context(**context_options)
            return browser_context


class AbstractLogin(ABC):
    @abstractmethod
    async def begin(self):
        pass

    @abstractmethod
    async def login_by_qrcode(self):
        pass

    @abstractmethod
    async def login_by_mobile(self):
        pass

    @abstractmethod
    async def login_by_cookies(self):
        pass


class AbstractStore(ABC):
    @abstractmethod
    async def store_content(self, content_item: Dict):
        pass

    @abstractmethod
    async def store_comment(self, comment_item: Dict):
        pass

    # TODO support all platform
    # only xhs is supported, so @abstractmethod is commented
    @abstractmethod
    async def store_creator(self, creator: Dict):
        pass


class AbstractStoreImage(ABC):
    # TODO: support all platform
    # only weibo is supported
    # @abstractmethod
    async def store_image(self, image_content_item: Dict):
        pass


class AbstractApiClient(ABC):
    @abstractmethod
    async def request(self, method, url, **kwargs):
        pass

    @abstractmethod
    async def update_cookies(self, browser_context: BrowserContext):
        pass
