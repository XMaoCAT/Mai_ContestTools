# 错误码说明

项目已改为严格真实数据模式：
- 不再使用模拟/假数据回退
- 接口失败会直接抛错
- 前端与模块加载器都带明确错误码

## 前端错误码（APP-*）

| 错误码 | 位置 | 可能原因 | 建议排查 |
|---|---|---|---|
| `APP-BOOT-001` | 启动流程 | `window.__xmaoCoreReady` 不存在 | 检查 `index.html` 是否先加载 `XMao_Core/core-loader.js`，再加载 `script.js` |
| `APP-BOOT-002` | 启动流程 | 核心模块加载失败 | 查看 `CORE-MODULE-*` 错误和 `/api/core-modules` 响应 |
| `APP-LANG-001` | 语言系统 | `XMao_Core/language.json` 返回 HTTP 错误 | 检查语言包文件是否存在、服务是否正常 |
| `APP-LANG-002` | 语言系统 | 语言包 JSON 结构无效 | 检查是否包含 `languages` 字段 |
| `APP-MAILIST-001` | `fetchMaiListFiles` | `/api/get-files` 返回 HTTP 错误 | 检查服务是否启动、路由是否可访问 |
| `APP-MAILIST-002` | `fetchMaiListFiles` | 接口返回 `success=false` | 查看后端日志和 `MaiList` 目录权限 |
| `APP-MAILIST-003` | `fetchMaiListFiles` | 返回格式异常（`files` 不是数组） | 检查后端返回 JSON 结构 |
| `APP-MAILIST-004` | `fetchMaiListFiles` | 其他读取失败 | 看浏览器 Network/Console 和后端报错 |
| `APP-CHARACTER-001` | `refreshCharacterFiles` | `/api/get-character-files` 返回 HTTP 错误 | 检查服务与路由 |
| `APP-CHARACTER-002` | `refreshCharacterFiles` | 接口返回 `success=false` | 查看后端日志与 `MaiList/Character` 目录权限 |
| `APP-CHARACTER-003` | `refreshCharacterFiles` | 返回格式异常（`files` 不是数组） | 检查后端返回 JSON 结构 |
| `APP-CHARACTER-004` | `refreshCharacterFiles` | 其他读取失败 | 看浏览器 Network/Console 和后端报错 |
| `APP-MATCH-001` | `endMatch` | `/api/save-match-result` 返回 HTTP 错误 | 检查是否使用新版 `start_server.py` 启动 |
| `APP-MATCH-002` | `endMatch` | 保存结果接口返回失败 | 检查 `Result` 目录写权限和后端错误信息 |
| `APP-RESULT-001` | `fetchResultFiles` | `/api/get-result-files` 返回 HTTP 错误 | 检查服务是否启动、路由是否存在 |
| `APP-RESULT-002` | `fetchResultFiles` | 结果列表接口返回 `success=false` | 查看后端日志中的具体错误 |
| `APP-RESULT-003` | `fetchResultFiles` | 返回格式异常（`files` 不是数组） | 检查后端 JSON 结构 |
| `APP-RESULT-004` | `fetchResultFiles` | 读取结果列表时发生未知异常 | 查看浏览器 Console 与后端日志 |
| `APP-RESULT-005` | `loadResultFileByName` | `/api/get-result-file` 返回 HTTP 错误 | 检查文件名是否存在、接口是否可访问 |
| `APP-RESULT-006` | `loadResultFileByName` | 结果文件接口返回 `success=false` | 检查 `Result/*.json` 文件内容和后端日志 |
| `APP-RESULT-007` | `normalizeLoadedMatchResult` | 结果文件内容结构无效 | 检查 JSON 是否为合法比赛结果对象 |
| `APP-RESULT-008` | `loadResultFileByName` | 加载结果文件时发生未知异常 | 查看浏览器 Console 与后端日志 |
| `APP-RANDOM-001` | 指定文件预加载 | 读取指定文件 HTTP 错误 | 检查 `MaiList/*.txt` 是否存在且可访问 |
| `APP-RANDOM-002` | `getRandomSong` | 曲库为空 | 确认数据库已成功加载 |
| `APP-RANDOM-003` | `getRandomSong` | 随机配置对象无效 | 检查弹窗流程与配置写入 |
| `APP-RANDOM-004` | `getRandomSong` | 当前筛选条件下无歌曲 | 放宽等级/流派条件 |
| `APP-RANDOM-005` | `getSpecificFileRandomSong` | 未选择指定文件 | 先选择文件再随机 |
| `APP-RANDOM-006` | `getSpecificFileRandomSong` | 曲库为空 | 先加载数据库 |
| `APP-RANDOM-007` | `getSpecificFileRandomSong` | 指定文件读取 HTTP 错误 | 检查文件路径与权限 |
| `APP-RANDOM-008` | `getSpecificFileRandomSong` | 文件内没有有效 `MusicID` | 检查文件内容是否为逗号分隔数字 |
| `APP-RANDOM-009` | `getSpecificFileRandomSong` | 文件内 ID 在当前曲库中都找不到 | 检查歌单与数据库版本是否匹配 |

## 模块加载错误码（CORE-MODULE-*）

| 错误码 | 位置 | 可能原因 | 建议排查 |
|---|---|---|---|
| `CORE-MODULE-001` | `fetchModules` | 无法访问 `/api/core-modules` | 检查服务是否启动 |
| `CORE-MODULE-002` | `fetchModules` | 模块接口返回非 200 | 检查后端路由和异常 |
| `CORE-MODULE-003` | `fetchModules` | 返回内容不是合法 JSON | 检查后端输出格式 |
| `CORE-MODULE-004` | `fetchModules` | 返回结构不符合约定 | 缺少 `success` 或 `modules` |
| `CORE-MODULE-005` | `fetchModules` | 未扫描到任何模块 | 检查 `XMao_Core` 下是否有模块目录 |
| `CORE-MODULE-006` | `loadModules` | 页面缺少动态容器 | 检查 `index.html` 是否有 `dynamicNavMenu` 与 `dynamicPagesHost` |
| `CORE-MODULE-007` | `loadScript` | 模块脚本加载失败 | 检查模块 `page.js` 路径/文件 |
| `CORE-MODULE-008` | `loadModules` | 模块缺少页面文件 | 检查模块 `page.html` 或 `module.json` 的 `page` 配置 |
| `CORE-MODULE-009` | `loadModules` | 模块页面请求失败 | 检查路径和网络 |
| `CORE-MODULE-010` | `loadModules` | 模块页面读取 HTTP 错误 | 检查文件存在性与权限 |

## 后端说明

- 比赛结果通过 `/api/save-match-result` 保存到 `Result/*.json`（真实写入）。
- 模块菜单通过 `/api/core-modules` 扫描 `XMao_Core/*` 生成（无假数据回退）。
- 如果异常持续，请按以下顺序排查：
1. 确认用最新 `start_server.py` 启动服务
2. 打开浏览器开发者工具查看 Network 和 Console
3. 查看服务端控制台输出的具体异常



# Error Codes

This project now runs in strict real-data mode:
- No mock-data fallback
- No default-data fallback on failures
- Failures are raised with explicit error codes

## Frontend Codes (`APP-*`)

| Code | Area | Possible Cause | What to Check |
|---|---|---|---|
| `APP-BOOT-001` | App startup | `window.__xmaoCoreReady` is missing | Ensure `index.html` loads `XMao_Core/core-loader.js` before `script.js`, and calls `window.XMaoCore.loadModules()` |
| `APP-BOOT-002` | App startup | Core module loading failed | Check `CORE-MODULE-*` errors and `/api/core-modules` response |
| `APP-LANG-001` | Language system | `XMao_Core/language.json` returned HTTP error | Verify language pack file exists and server is healthy |
| `APP-LANG-002` | Language system | Invalid language-pack JSON schema | Ensure `languages` field exists in JSON |
| `APP-MAILIST-001` | `fetchMaiListFiles` | `/api/get-files` returned HTTP error | Confirm server is running and endpoint is reachable |
| `APP-MAILIST-002` | `fetchMaiListFiles` | API returned `success=false` | Check backend error details and `MaiList` permissions |
| `APP-MAILIST-003` | `fetchMaiListFiles` | Invalid response schema | Backend returned non-array `files` |
| `APP-MAILIST-004` | `fetchMaiListFiles` | Unknown list loading failure | Check browser Network/Console and backend logs |
| `APP-CHARACTER-001` | `refreshCharacterFiles` | `/api/get-character-files` returned HTTP error | Confirm server and route status |
| `APP-CHARACTER-002` | `refreshCharacterFiles` | API returned `success=false` | Check backend logs and `MaiList/Character` permissions |
| `APP-CHARACTER-003` | `refreshCharacterFiles` | Invalid response schema | Backend returned non-array `files` |
| `APP-CHARACTER-004` | `refreshCharacterFiles` | Unknown character-list failure | Check browser Network/Console and backend logs |
| `APP-MATCH-001` | `endMatch` | `/api/save-match-result` returned HTTP error | Ensure updated `start_server.py` is running |
| `APP-MATCH-002` | `endMatch` | Save API returned failure | Check `Result` write permission and backend error |
| `APP-RESULT-001` | `fetchResultFiles` | `/api/get-result-files` returned HTTP error | Confirm server status and route availability |
| `APP-RESULT-002` | `fetchResultFiles` | API returned `success=false` | Check backend logs for details |
| `APP-RESULT-003` | `fetchResultFiles` | Invalid response schema (`files` is not array) | Verify backend JSON payload |
| `APP-RESULT-004` | `fetchResultFiles` | Unknown result-list loading failure | Check browser Console and backend logs |
| `APP-RESULT-005` | `loadResultFileByName` | `/api/get-result-file` returned HTTP error | Verify file existence and route access |
| `APP-RESULT-006` | `loadResultFileByName` | API returned `success=false` | Check `Result/*.json` and backend logs |
| `APP-RESULT-007` | `normalizeLoadedMatchResult` | Invalid result-file payload structure | Validate JSON match-result object format |
| `APP-RESULT-008` | `loadResultFileByName` | Unknown result-file loading failure | Check browser Console and backend logs |
| `APP-RANDOM-001` | Specific-file preload | Specific file request returned HTTP error | Check selected `MaiList/*.txt` exists and is accessible |
| `APP-RANDOM-002` | `getRandomSong` | Song database is empty | Confirm database loaded correctly |
| `APP-RANDOM-003` | `getRandomSong` | Invalid random config object | Verify random config flow from dialog |
| `APP-RANDOM-004` | `getRandomSong` | No songs match current filters | Relax level/genre filters |
| `APP-RANDOM-005` | `getSpecificFileRandomSong` | No specific file selected | Select a file before randomizing |
| `APP-RANDOM-006` | `getSpecificFileRandomSong` | Song database is empty | Load database first |
| `APP-RANDOM-007` | `getSpecificFileRandomSong` | Specific file request returned HTTP error | Check file path and access |
| `APP-RANDOM-008` | `getSpecificFileRandomSong` | No valid `MusicID` values in file | Ensure file contains comma-separated numeric IDs |
| `APP-RANDOM-009` | `getSpecificFileRandomSong` | IDs in file do not exist in current database | Check list/database version alignment |

## Module Loader Codes (`CORE-MODULE-*`)

| Code | Area | Possible Cause | What to Check |
|---|---|---|---|
| `CORE-MODULE-001` | `fetchModules` | Cannot reach `/api/core-modules` | Server not running or route unavailable |
| `CORE-MODULE-002` | `fetchModules` | Non-200 HTTP from module API | Backend route/handler failure |
| `CORE-MODULE-003` | `fetchModules` | Invalid JSON from module API | Backend returned non-JSON content |
| `CORE-MODULE-004` | `fetchModules` | Invalid payload schema | Missing `success` or `modules` |
| `CORE-MODULE-005` | `fetchModules` | No modules discovered | Check subfolders under `XMao_Core` |
| `CORE-MODULE-006` | `loadModules` | Dynamic containers are missing | Ensure `index.html` has `dynamicNavMenu` and `dynamicPagesHost` |
| `CORE-MODULE-007` | `loadScript` | Module script failed to load | Check module `page.js` path or file existence |
| `CORE-MODULE-008` | `loadModules` | Module page file is missing | Check module `page.html` or `module.json` `page` field |
| `CORE-MODULE-009` | `loadModules` | Module page fetch failed | Check path/network availability |
| `CORE-MODULE-010` | `loadModules` | Module page returned HTTP error | Check file existence and permissions |

## Backend Notes

- Match results are now saved to `Result/*.json` via `/api/save-match-result`.
- Module menu items are generated from `XMao_Core/*` via `/api/core-modules`.
- If issues persist:
1. Start server with the updated `start_server.py`
2. Check browser Network + Console details
3. Inspect backend terminal logs/tracebacks
