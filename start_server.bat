@set "XMaoCAT=0"
@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
chcp 65001 >nul

set "PROJECT_DIR=%cd%"
set "REQ_FILE=%PROJECT_DIR%\requirements.txt"
set "VENV_DIR=%PROJECT_DIR%\.venv"
set "LOCAL_PY_HOME=%PROJECT_DIR%\.python_local"
set "PYTHON_INSTALL_URL=https://www.python.org/ftp/python/3.13.2/python-3.13.2-amd64.exe"
set "PYTHON_INSTALLER=%TEMP%\python-3.13.2-amd64.exe"
set "PYTHON_EXE="
set "SYSTEM_PY_EXE="
set "HAS_SYSTEM_PY=0"

if /I "%~1"=="--check" goto :check_only

echo.
echo [INFO] 启动前环境检测[如想每次都使用系统自带的环境启动程序，请打开bat将XMaoCAT=0改成=1]
echo.

call :detect_system_python
if defined PYTHON_EXE (
    set "HAS_SYSTEM_PY=1"
    set "SYSTEM_PY_EXE=%PYTHON_EXE%"
    echo [INFO] 已检测到系统 Python: "!PYTHON_EXE!"
) else (
    echo [WARN] 未检测到系统 Python。
)
set "PYTHON_EXE="

set "MODE_INPUT="
if "%XMaoCAT%"=="1" (
    echo [INFO] XMaoCAT=1，已启用快速启动：默认使用系统 Python。
    set "PY_MODE=system"
    goto :mode_selected
)

:ask_mode
if "%HAS_SYSTEM_PY%"=="1" (
    set /p MODE_INPUT=请选择运行方式：Y=使用系统Python，N=使用项目虚拟环境: 
) else (
    set /p MODE_INPUT=未检测到系统Python。是否安装到系统？Y=系统安装，N=安装到项目目录: 
)
if not defined MODE_INPUT set "MODE_INPUT=Y"

if /I "%MODE_INPUT%"=="Y" (
    set "PY_MODE=system"
) else if /I "%MODE_INPUT%"=="N" (
    set "PY_MODE=local"
) else (
    echo [ERROR] 请输入 Y 或 N。
    set "MODE_INPUT="
    goto :ask_mode
)

:mode_selected
call :resolve_python "%PY_MODE%"
if errorlevel 1 goto :fail

if /I "%PY_MODE%"=="system" (
    echo [INFO] 已选择系统 Python，正在检查依赖完整性...
) else (
    echo [INFO] 正在检查项目环境依赖完整性...
)
call :ensure_requirements "%PYTHON_EXE%"
if errorlevel 1 goto :fail

echo.
echo 当前解释器: "%PYTHON_EXE%"
echo.

"%PYTHON_EXE%" start_server.py %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] start_server.py 退出码为 %EXIT_CODE%。
    pause
)
exit /b %EXIT_CODE%

:check_only
if exist "%VENV_DIR%\Scripts\python.exe" (
    echo Python 检测通过（已找到项目虚拟环境）。
    exit /b 0
)
call :detect_system_python
if defined PYTHON_EXE (
    echo Python 检测通过。
    exit /b 0
)
echo [ERROR] 未找到 Python。
exit /b 1

:resolve_python
set "MODE=%~1"
set "PYTHON_EXE="

if /I "%MODE%"=="system" (
    if defined SYSTEM_PY_EXE (
        set "PYTHON_EXE=%SYSTEM_PY_EXE%"
        exit /b 0
    )

    call :detect_system_python
    if defined PYTHON_EXE exit /b 0

    echo [INFO] 未检测到系统 Python，正在下载安装包...
    call :download_python_installer
    if errorlevel 1 exit /b 1

    call :install_python_system
    if errorlevel 1 exit /b 1

    call :detect_system_python
    if defined PYTHON_EXE exit /b 0

    call :detect_user_python_install
    if defined PYTHON_EXE exit /b 0

    echo [ERROR] Python 安装完成，但未找到 python.exe。
    exit /b 1
)

if /I "%MODE%"=="local" (
    if exist "%VENV_DIR%\Scripts\python.exe" (
        set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
        exit /b 0
    )

    set "BASE_PY_EXE="
    if defined SYSTEM_PY_EXE (
        set "BASE_PY_EXE=%SYSTEM_PY_EXE%"
    ) else (
        call :detect_system_python
        if defined PYTHON_EXE set "BASE_PY_EXE=%PYTHON_EXE%"
        set "PYTHON_EXE="
    )

    if not defined BASE_PY_EXE if exist "%LOCAL_PY_HOME%\python.exe" set "BASE_PY_EXE=%LOCAL_PY_HOME%\python.exe"

    if not defined BASE_PY_EXE (
        echo [INFO] 未检测到可用基础 Python，正在下载项目本地运行时...
        call :download_python_installer
        if errorlevel 1 exit /b 1

        call :install_python_local "%LOCAL_PY_HOME%"
        if errorlevel 1 exit /b 1

        if exist "%LOCAL_PY_HOME%\python.exe" set "BASE_PY_EXE=%LOCAL_PY_HOME%\python.exe"
    )

    if not defined BASE_PY_EXE (
        echo [ERROR] 准备项目本地 Python 运行时失败。
        exit /b 1
    )

    echo [INFO] 正在创建项目虚拟环境: "%VENV_DIR%"
    "%BASE_PY_EXE%" -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] 创建项目虚拟环境失败。
        exit /b 1
    )

    if not exist "%VENV_DIR%\Scripts\python.exe" (
        echo [ERROR] 虚拟环境创建后未找到 python.exe。
        exit /b 1
    )

    set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
    exit /b 0
)

echo [ERROR] 未知模式: %MODE%
exit /b 1

:detect_system_python
set "PYTHON_EXE="
for /f "usebackq delims=" %%P in (`py -3 -c "import sys;print(sys.executable)" 2^>nul`) do (
    call :use_candidate_python "%%~P"
    if not errorlevel 1 goto :detect_system_done
)
for /f "usebackq delims=" %%P in (`python -c "import sys;print(sys.executable)" 2^>nul`) do (
    call :use_candidate_python "%%~P"
    if not errorlevel 1 goto :detect_system_done
)
for /f "usebackq delims=" %%P in (`where python 2^>nul`) do (
    call :use_candidate_python "%%~P"
    if not errorlevel 1 goto :detect_system_done
)
:detect_system_done
exit /b 0

:use_candidate_python
set "CANDIDATE=%~1"
if not defined CANDIDATE exit /b 1
if not exist "%CANDIDATE%" exit /b 1
"%CANDIDATE%" -c "import tkinter as tk; r=tk.Tk(); r.withdraw(); r.destroy()" >nul 2>&1
if errorlevel 1 exit /b 1
set "PYTHON_EXE=%CANDIDATE%"
exit /b 0

:detect_user_python_install
set "PYTHON_EXE="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=Join-Path $env:LocalAppData 'Programs\Python'; if(Test-Path $root){Get-ChildItem -Path $root -Directory | Sort-Object Name -Descending | ForEach-Object { $p=Join-Path $_.FullName 'python.exe'; if(Test-Path $p){Write-Output $p; break} }}"`) do (
    call :use_candidate_python "%%~P"
    if not errorlevel 1 goto :detect_user_python_done
)
:detect_user_python_done
exit /b 0

:download_python_installer
if exist "%PYTHON_INSTALLER%" del /f /q "%PYTHON_INSTALLER%" >nul 2>&1
echo [INFO] 正在下载 Python 安装包...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%PYTHON_INSTALL_URL%' -OutFile '%PYTHON_INSTALLER%' -UseBasicParsing"
if errorlevel 1 (
    echo [WARN] PowerShell 下载失败，尝试使用 curl...
    curl -L "%PYTHON_INSTALL_URL%" -o "%PYTHON_INSTALLER%"
    if errorlevel 1 (
        echo [ERROR] 下载 Python 安装包失败。
        exit /b 1
    )
)
if not exist "%PYTHON_INSTALLER%" (
    echo [ERROR] 未生成 Python 安装包文件: "%PYTHON_INSTALLER%"
    exit /b 1
)
exit /b 0

:install_python_system
echo [INFO] 正在安装系统 Python（当前用户，并写入 PATH）...
start "" /wait "%PYTHON_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1 Shortcuts=0
if errorlevel 1 (
    echo [ERROR] 系统 Python 安装失败。
    exit /b 1
)
exit /b 0

:install_python_local
set "TARGET_DIR=%~1"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%" >nul 2>&1
echo [INFO] 正在安装项目本地 Python 到 "%TARGET_DIR%" ...
start "" /wait "%PYTHON_INSTALLER%" /quiet InstallAllUsers=0 TargetDir="%TARGET_DIR%" PrependPath=0 Include_pip=1 Include_launcher=0 Include_test=0 Shortcuts=0
if errorlevel 1 (
    echo [ERROR] 项目本地 Python 安装失败。
    exit /b 1
)
exit /b 0

:ensure_requirements
set "RUN_PY=%~1"
if not exist "%REQ_FILE%" (
    echo [WARN] 未找到 requirements.txt，跳过依赖安装。
    exit /b 0
)
echo [INFO] 正在安装 requirements.txt 依赖...
"%RUN_PY%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] 未检测到 pip，正在执行 ensurepip...
    "%RUN_PY%" -m ensurepip --upgrade
    if errorlevel 1 (
        echo [ERROR] 初始化 pip 失败。
        exit /b 1
    )
)
"%RUN_PY%" -m pip install --disable-pip-version-check -r "%REQ_FILE%"
if errorlevel 1 (
    echo [ERROR] 安装 requirements.txt 依赖失败。
    exit /b 1
)

set "PIP_CHECK_LOG=%TEMP%\xmao_pip_check_%RANDOM%_%RANDOM%.log"
"%RUN_PY%" -m pip check >"%PIP_CHECK_LOG%" 2>&1
if errorlevel 1 (
    echo [WARN] pip check 未通过，正在尝试自动补装缺失依赖...
    call :fix_pip_check_missing "%RUN_PY%" "%PIP_CHECK_LOG%"
    if errorlevel 1 (
        if /I "%PY_MODE%"=="system" (
            echo [WARN] 系统 Python 存在全局依赖冲突，已忽略并继续启动。
            echo [WARN] 详细信息如下:
            type "%PIP_CHECK_LOG%"
            del /f /q "%PIP_CHECK_LOG%" >nul 2>&1
            exit /b 0
        ) else (
            echo [ERROR] 依赖完整性检查失败（pip check 未通过）。
            type "%PIP_CHECK_LOG%"
            del /f /q "%PIP_CHECK_LOG%" >nul 2>&1
            exit /b 1
        )
    )
)
del /f /q "%PIP_CHECK_LOG%" >nul 2>&1
exit /b 0

:fix_pip_check_missing
set "CHECK_PY=%~1"
set "CHECK_LOG=%~2"
set "MISSING_PKGS="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$lines=Get-Content -Path '%CHECK_LOG%' -ErrorAction SilentlyContinue; $pkgs=@(); foreach($line in $lines){ if($line -match 'requires ([^,]+), which is not installed\.'){ $pkgs += $Matches[1].Trim() } }; $pkgs=$pkgs | Sort-Object -Unique; if($pkgs.Count -gt 0){ $pkgs -join ' ' }"`) do (
    set "MISSING_PKGS=%%P"
)
if defined MISSING_PKGS (
    echo [INFO] 检测到缺失依赖: %MISSING_PKGS%
    "%CHECK_PY%" -m pip install --disable-pip-version-check %MISSING_PKGS%
    if errorlevel 1 exit /b 1
)
"%CHECK_PY%" -m pip check >"%CHECK_LOG%" 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:fail
echo.
echo [ERROR] 启动前检查失败。
pause
exit /b 1
