@echo off
cd /d d:\DESKTOP\my\project\chatbot-analysis
call venv_chatbot\Scripts\activate

echo Starting project...
echo.

echo 1. Checking and closing existing services

echo Closing existing backend processes...
for /f "tokens=2" %%a in ('tasklist /fi "WINDOWTITLE eq d:\DESKTOP\my\project\chatbot-analysis\backend*"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Closing existing frontend processes...
for /f "tokens=2" %%a in ('tasklist /fi "WINDOWTITLE eq d:\DESKTOP\my\project\chatbot-analysis\frontend*"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo 2. Checking database services

echo Checking MongoDB service...
sc query MongoDB >nul 2>&1 && echo MongoDB service is running || (
  mongod --version >nul 2>&1 && echo MongoDB found but not running as a service || echo MongoDB not found in PATH
)

echo 启动MySQL…
set MYSQL_PATH=D:\phpstudy_pro\Extensions\MySQL8.0.12

:: 检查MySQL是否已经在运行
mysqladmin ping -u root --silent >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo MySQL已经在运行中
) else (
  echo 启动MySQL...
  start "MySQL" /b "%MYSQL_PATH%\bin\mysqld.exe" --console
  echo 等待MySQL启动...
  timeout /t 5 /nobreak >nul
  
  :: 检查MySQL是否成功启动
  mysqladmin ping -u root --silent >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    echo MySQL启动成功
  ) else (
    echo MySQL启动失败，请手动启动MySQL
    echo 命令: %MYSQL_PATH%\bin\mysqld.exe --console
  )
)

echo.
echo 3. Starting backend service
start cmd /c "cd /d d:\DESKTOP\my\project\chatbot-analysis\backend && python main.py"

echo.
echo 4. Starting frontend service
start cmd /c "cd /d d:\DESKTOP\my\project\chatbot-analysis\frontend && npm run dev"

echo.
echo Project started!
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo 
