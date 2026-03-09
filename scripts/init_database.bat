@echo off
echo 初始化数据库...

set MYSQL_PATH=D:\phpstudy_pro\Extensions\MySQL8.0.12
set MYSQL_BIN=%MYSQL_PATH%\bin
set PROJECT_PATH=d:\DESKTOP\my\project\chatbot-analysis
set SQL_PATH=%PROJECT_PATH%\sql

echo 检查MySQL服务...
"%MYSQL_BIN%\mysqladmin" -u root ping
if %ERRORLEVEL% NEQ 0 (
  echo MySQL服务未运行，尝试启动...
  start "" /b "%MYSQL_PATH%\bin\mysqld.exe" --console
  timeout /t 5 /nobreak > nul
)

echo 创建media_crawler数据库...
"%MYSQL_BIN%\mysql" -u root -e "CREATE DATABASE IF NOT EXISTS media_crawler CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo 导入数据表...
for %%f in ("%SQL_PATH%\*.sql") do (
  echo 导入 %%~nxf...
  "%MYSQL_BIN%\mysql" -u root media_crawler < "%%f"
)

echo 检查数据库表...
"%MYSQL_BIN%\mysql" -u root -e "USE media_crawler; SHOW TABLES;"

echo 数据库初始化完成！
pause
