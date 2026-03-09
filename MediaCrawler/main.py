# 声明：本代码仅供学习和研究目的使用。使用者应遵守以下原则：  
# 1. 不得用于任何商业用途。  
# 2. 使用时应遵守目标平台的使用条款和robots.txt规则。  
# 3. 不得进行大规模爬取或对平台造成运营干扰。  
# 4. 应合理控制请求频率，避免给目标平台带来不必要的负担。   
# 5. 不得用于任何非法或不当的用途.
#   
# 详细许可条款请参阅项目根目录下的LICENSE文件。  
# 使用本代码即表示您同意遵守上述原则和LICENSE中的所有条款。  


import asyncio
import sys
import requests
from datetime import datetime

import cmd_arg
import config
import db
from base.base_crawler import AbstractCrawler
from media_platform.bilibili import BilibiliCrawler
from media_platform.douyin import DouYinCrawler
from media_platform.kuaishou import KuaishouCrawler
from media_platform.tieba import TieBaCrawler
from media_platform.weibo import WeiboCrawler
from media_platform.xhs import XiaoHongShuCrawler
from media_platform.zhihu import ZhihuCrawler


class CrawlerFactory:
    CRAWLERS = {
        "xhs": XiaoHongShuCrawler,
        "dy": DouYinCrawler,
        "bili": BilibiliCrawler
    }

    @staticmethod
    def create_crawler(platform: str) -> AbstractCrawler:
        crawler_class = CrawlerFactory.CRAWLERS.get(platform)
        if not crawler_class:
            raise ValueError("无效的媒体平台，目前仅支持小红书(xhs)、抖音(dy)和B站(bili)")
        return crawler_class()


def init_crawler(platform: str) -> AbstractCrawler:
    """
    初始化爬虫
    Args:
        platform: 平台名称

    Returns:

    """
    if platform == "xhs":
        return XiaoHongShuCrawler()
    elif platform == "dy":
        return DouYinCrawler()
    elif platform == "bili":
        return BilibiliCrawler()
    else:
        raise ValueError(f"不支持的平台: {platform}，目前仅支持小红书(xhs)、抖音(dy)和B站(bili)")


def scrape_data_by_date(url, date):
    # Format the date to the required string format (e.g., 'YYYY-MM-DD')
    formatted_date = date.strftime('%Y-%m-%d')
    # Send a request to the URL with the date parameter
    response = requests.get(url, params={'date': formatted_date})

    if response.status_code == 200:
        # Parse the response data (assuming JSON format)
        data = response.json()
        # Filter data based on the date if necessary
        filtered_data = [item for item in data if item['date'] == formatted_date]
        return filtered_data
    else:
        print(f'Error: {response.status_code}')
        return None


async def main():
    # parse cmd
    await cmd_arg.parse_cmd()

    # init db
    if config.SAVE_DATA_OPTION == "db":
        await db.init_db()

    crawler = init_crawler(platform=config.PLATFORM)
    await crawler.start()

    if config.SAVE_DATA_OPTION == "db":
        await db.close()

    # Example usage
    url = 'https://example.com/api/data'
    date_to_scrape = datetime(2025, 3, 12)  # Specify the date you want to scrape
    scraped_data = scrape_data_by_date(url, date_to_scrape)
    print(scraped_data)


if __name__ == '__main__':
    try:
        # asyncio.run(main())
        asyncio.get_event_loop().run_until_complete(main())
    except KeyboardInterrupt:
        sys.exit()
