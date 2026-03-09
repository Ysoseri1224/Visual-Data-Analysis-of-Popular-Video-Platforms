@echo off
echo 正在为两个项目创建独立的虚拟环境...

REM 为MediaCrawler创建虚拟环境
cd d:\DESKTOP\my\project\MediaCrawler
python -m venv venv_mediacrawler
call venv_mediacrawler\Scripts\activate
pip install -r requirements.txt
deactivate

REM 为chatbot-analysis创建虚拟环境
cd d:\DESKTOP\my\project\chatbot-analysis
python -m venv venv_chatbot
call venv_chatbot\Scripts\activate
cd backend
pip install -r requirements.txt
pip install pydantic-settings
deactivate

echo 虚拟环境创建完成！
echo.
echo 使用方法：
echo 1. 运行MediaCrawler：
echo    cd d:\DESKTOP\my\project\MediaCrawler
echo    call venv_mediacrawler\Scripts\activate
echo    python auto_crawler.py
echo.
echo 2. 运行chatbot-analysis：
echo    cd d:\DESKTOP\my\project\chatbot-analysis
echo    call venv_chatbot\Scripts\activate
echo    cd backend
echo    python main.py
echo.
echo 3. 完成后记得使用 deactivate 命令退出虚拟环境

pause
