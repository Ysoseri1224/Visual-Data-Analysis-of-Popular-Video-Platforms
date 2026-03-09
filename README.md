# 热门视频平台数据可视化分析系统

一个面向热门自媒体平台（抖音、B站、小红书等）的**全栈数据分析平台**，集数据爬取、智能对话式查询、自动SQL生成与可视化图表于一体。

---

## 项目概述

本系统由三个核心模块组成：

1. **MediaCrawler（数据采集层）**：基于 Playwright 的多平台爬虫，支持抖音、B站、小红书、快手、微博、贴吧、知乎等平台的视频、评论、创作者数据采集。
2. **Backend（智能分析层）**：基于 FastAPI 构建的后端服务，集成 DeepSeek 大模型实现自然语言转SQL（NL2SQL），支持多轮对话式数据查询。
3. **Frontend（可视化展示层）**：基于 Next.js + ECharts 构建的前端界面，提供交互式图表和数据看板。

---

## 系统架构

```
chatbot-analysis/
├── MediaCrawler/          # 多平台数据爬虫模块
│   ├── media_platform/    # 各平台爬虫实现（抖音、B站、小红书等）
│   ├── store/             # 数据存储（MySQL / CSV / JSON）
│   ├── config/            # 爬虫配置
│   └── main.py            # 爬虫入口
├── backend/               # FastAPI 后端服务
│   ├── app/
│   │   ├── api/           # 接口路由（认证、对话、数据查询、可视化等）
│   │   ├── services/      # 业务逻辑（DeepSeek AI、NL2SQL、数据服务）
│   │   ├── models/        # 数据模型
│   │   └── db/            # 数据库连接（MongoDB + MySQL）
│   └── main.py            # 后端入口
├── frontend/              # Next.js 前端应用
│   └── src/
│       ├── pages/         # 页面（登录、仪表盘、数据查询、设置等）
│       ├── components/    # 组件（聊天、图表、布局等）
│       └── services/      # API 调用服务
├── nl2sql_model/          # NL2SQL 提示词模板与模型配置
├── sql/                   # 数据库初始化 SQL 文件
└── scripts/               # 环境初始化脚本
```

---

## 功能特性

### 数据采集（MediaCrawler）

| 平台   | 关键词搜索 | 指定内容爬取 | 评论采集 | 创作者主页 | 登录态缓存 | IP 代理池 |
|--------|-----------|-------------|---------|-----------|-----------|----------|
| 抖音   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| B 站   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| 小红书 | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| 快手   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| 微博   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| 贴吧   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |
| 知乎   | ✅         | ✅           | ✅       | ✅         | ✅         | ✅        |

### 智能分析后端

- **自然语言转SQL**：通过 DeepSeek API，将用户的中文问题自动转换为 MySQL 查询语句
- **多轮对话**：支持上下文连贯的对话式数据查询，并保存对话历史
- **数据可视化生成**：自动推断合适的图表类型（柱状图、折线图、饼图等）并生成 ECharts 配置
- **数据连接管理**：支持连接外部 MySQL 数据库，动态获取表结构
- **用户权限管理**：基于 JWT 的用户注册/登录/角色管理（admin / user）
- **系统监控**：提供后端运行状态监控和日志查看接口

### 前端可视化

- **仪表盘**：展示查询统计、对话数量、成功率等关键指标
- **交互式图表**：基于 ECharts 与 Chart.js 的丰富可视化图表
- **对话式查询界面**：类 ChatGPT 的对话框，输入自然语言即可获取数据与图表
- **数据管理**：支持 CSV/JSON 文件上传与数据预览
- **个人设置与管理员后台**：用户信息管理、系统参数配置

---

## 技术栈

| 层级       | 技术                                         |
|------------|----------------------------------------------|
| 数据采集   | Python、Playwright、异步爬虫框架              |
| 后端框架   | FastAPI、Uvicorn                             |
| AI 模型    | DeepSeek API（Chat + NL2SQL）                |
| 数据库     | MySQL 8.0（业务数据）、MongoDB（对话历史）   |
| 前端框架   | Next.js 14、React 18、TypeScript             |
| UI 样式    | Tailwind CSS、Framer Motion                  |
| 图表库     | ECharts 5、Chart.js 4、ApexCharts            |
| 身份认证   | JWT（python-jose）、bcrypt 密码加密          |

---

## 快速开始

### 前置依赖

- Python 3.9+
- Node.js 16+
- MySQL 8.0
- MongoDB（本地或远程）
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 1. 克隆仓库

```bash
git clone https://github.com/Ysoseri1224/Visual-Data-Analysis-of-Popular-Video-Platforms.git
cd Visual-Data-Analysis-of-Popular-Video-Platforms
```

### 2. 配置环境变量

在 `backend/` 目录下创建 `.env` 文件：

```env
SECRET_KEY=your-secret-key
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=stardata
DEEPSEEK_API_KEY=your-deepseek-api-key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=media_crawler
```

### 3. 初始化数据库

```bash
# 导入 MySQL 数据（抖音、B站等平台数据）
mysql -u root -p media_crawler < sql/media.sql
mysql -u root -p media_crawler < sql/bilibili_video.sql
mysql -u root -p media_crawler < sql/bilibili_up_info.sql
```

### 4. 启动后端服务

```bash
cd backend

# 创建并激活虚拟环境
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
python main.py
# 后端服务运行于 http://localhost:8080
```

### 5. 启动前端服务

```bash
cd frontend
npm install
npm run dev
# 前端服务运行于 http://localhost:3000
```

### 6. 一键启动（Windows）

在项目根目录直接运行：

```bash
start.bat
```

---

## 数据采集使用方法

```bash
cd MediaCrawler

# 安装依赖
pip install -r requirements.txt
playwright install

# 按关键词搜索抖音视频
python main.py --platform dy --lt qrcode --type search

# 按关键词搜索 B 站视频
python main.py --platform bili --lt cookie --type search

# 查看所有支持的参数
python main.py --help
```

数据默认保存至 MySQL 数据库，也可配置为保存到 `data/` 目录下的 CSV 或 JSON 文件。

---

## 项目结构说明

### 后端 API 路由

| 路由前缀           | 说明             |
|--------------------|-----------------|
| `/api/v1/auth`     | 用户注册与登录   |
| `/api/v1/conversations` | 对话历史管理 |
| `/api/v1/AIchat`   | AI 对话与 NL2SQL |
| `/api/v1/visualization` | 图表配置生成 |
| `/api/v1/connections` | 数据库连接管理 |
| `/api/v1/schema`   | 数据库表结构查询 |
| `/api/v1/monitoring` | 系统监控       |
| `/api/v1/logs`     | 日志查看         |

### 数据存储

- **MySQL**：存储爬取的视频、评论、创作者等结构化数据
- **MongoDB**：存储用户账户、对话历史、消息记录等非结构化数据

---

## 免责声明

本项目仅供学习和技术研究使用，请勿用于任何商业目的或违法行为。使用爬虫程序前，请确保符合目标平台的服务条款及中华人民共和国相关法律法规。开发者对因使用本项目引发的任何法律责任不承担责任。

---

## License

[Apache License 2.0](LICENSE)
