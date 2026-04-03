# XMaoMaiContestTools

XMaoMaiContestTools 是一个本地化的 maimai 比赛辅助工具，包含：
1. Web 前端（抽歌、比赛、结果展示）
2. Python GUI 控制器（启动服务、下载资源、初始化）
3. 下载脚本（曲库 JSON 与曲绘资源）

适合用于线下比赛、活动排位、成绩记录与结果导出。

##  CreateQR.html
用于生成检录二维码
## 主要功能

1. 人员检录、分组与比赛流程管理
2. 比赛结果保存为 `Result/*.json`
3. 结果页面读取 JSON 生成晋级图
4. 合并多场结果，生成总赛程图并导出 PNG
5. 导出胜利者名单 JSON 到 `MaiList/Character`
6. GUI 一键下载曲库（`DownloadCore/Download-MaiJson.py`）
7. GUI 一键下载曲绘（`DownloadCore/Download_Mai_Illustration.py`，最多 32 线程）
8. 内存加载器缓存包编译（提升曲绘读取速度）
9. 初始化软件（清理使用痕迹并重置状态）

## 运行环境

1. Windows 10/11（推荐）
2. Python 3（需可用 `tkinter`）
3. 可联网环境（下载曲库/曲绘时需要）

## 快速开始（推荐）

1. 在项目根目录双击 `start_server.bat`
2. 首次运行按提示选择 Python 模式：
   - `Y`：使用系统 Python
   - `N`：使用项目虚拟环境
3. 脚本会自动检查并安装 `requirements.txt` 依赖
4. GUI 打开后建议按顺序执行：
   - 下载曲库
   - 下载曲绘
   - （可选）编译缓存包
   - 启动服务
   - 打开浏览器

## `XMaoCAT` 启动开关

在 `start_server.bat` 第一行：

```bat
@set "XMaoCAT=0"
```

1. `XMaoCAT=0`：正常询问启动模式（默认）
2. `XMaoCAT=1`：跳过询问，直接走系统 Python 模式

## 手动运行（开发/调试）

```powershell
pip install -r requirements.txt
python start_server.py
```

仅检查 Python 可用性：

```powershell
start_server.bat --check
```

## 项目目录说明

1. `Data/`：曲库 JSON（可包含多份），以及部分静态资源
2. `MaiSongLib/`：曲绘图片资源
3. `Result/`：比赛结果 JSON
4. `Result/ResultDiagram/`：导出的赛程图 PNG
5. `MaiList/`：歌单 TXT 与角色名单
6. `MaiList/Character/`：导出的胜利者 JSON
7. `DownloadCore/`：曲库/曲绘下载脚本
8. `XMao_Core/`：前端模块、语言包、背景资源
9. `.cache/`：缓存包与重置状态文件

## GUI 按钮说明（核心）

1. 启动服务 / 停止服务 / 打开浏览器
2. 下载曲库 / 下载曲绘
3. 初始化软件 / 编译缓存包
4. 打开截图文件夹 / 用户信息文件夹 / 歌曲文件夹 / 歌单文件夹 / 成绩文件夹 / 壁纸文件夹

## 常见问题

1. `is not recognized as an internal or external command`
   - 说明在 `.bat` 里写了“裸文本”备注。
   - 备注请使用 `REM` 或 `::` 开头。

2. `Can't find a usable init.tcl`
   - 当前 Python 缺少/损坏 Tcl/Tk 运行时。
   - 请修复系统 Python，或使用 `N` 模式让项目创建独立环境。

3. 下载失败
   - 检查网络、代理、目标站点可访问性。
   - GUI 日志会打印失败原因和脚本返回码。

## 错误码文档

详细错误码见：`ERROR_CODES.md`

