# 项目受限 Blender MCP

这是 Mechanism Studio 自有的 stdio MCP 桥接，使用官方 MCP Python SDK 1.26.0。它没有安装允许任意 Python 或 socket 命令的通用 Blender addon。锁芯模型由便携 Blender 和固定建模脚本生成；MCP 当前用于原生场景检查与渲染验证。

## 范围与四个固定工具

| 工具 | 操作 |
| --- | --- |
| `status` | 检查环境、审核源码和原生场景摘要；不启动 Blender |
| `inspect_lock` | 只读打开固定 `prototype-3d/assets/lock.blend`，检查实际 24 个部件 |
| `rebuild_lock` | 明确调用时才运行审核过的 `build-lock.py`，覆盖项目锁芯资产 |
| `render_preview` | 从五个固定机位选择一个，以 CPU、4 样本、900×600 渲染项目内 PNG |

源码所在目录推导独立项目根。父目录与兄弟 `anatomy-reference` 均在允许范围之外。工具不接收代码、脚本路径、文件路径、命令、host 或额外参数；机位仅为 `overview`、`section`、`end`、`detail`、`rear`。固定便携 Blender 禁用场景自动脚本，拒绝越界、symlink/junction/reparse point，并用文件锁避免并发操作。生成器、规格、操作源码或原生场景变化，需要重新审核项目内摘要。

渲染只写 `prototype-3d/mcp-preview/lock-{camera}.png`，不保存 `.blend`，也不改网页资产和豆包音频。子进程不转发 API 密钥、用户 Python 路径或 Blender 偏好，没有网络监听或外部资产服务。以上是接口与路径保护，**不是操作系统沙箱**；不更改 Codex 现有权限。

## 源码与本地环境

以下路径均相对本项目根：

- `tools/blender-mcp/`：可公开的服务器、固定操作、审核摘要、测试、启动器、带哈希依赖锁。
- `.tools/blender-mcp/`：本地 `.venv`、`runtime`、`cache`、`temp`、日志和进程锁，不上传 GitHub。
- `.tools/blender-4.5.14-windows-x64/`：便携 Blender 与其 Python，不上传 GitHub。
- `.codex/config.toml`：本机项目配置，不上传 GitHub。

没有用户级安装、全局配置或 PATH 修改。Windows venv 的 `pyvenv.cfg` 记录本机 Blender Python 路径；迁移本地运行环境时需修正这个路径并实际验证 `import mcp`。其他机器需要在本项目 `.tools` 重建环境，不应提交或复用原机器的 venv。

依赖由 `requirements.lock` 锁定并带 SHA256。可使用已有 uv 与 Blender Python 创建项目内 venv，再执行 `uv pip sync --require-hashes --only-binary :all: --no-python-downloads`；创建和安装时将 `UV_CACHE_DIR`、`TEMP`、`TMP` 明确指向 `.tools/blender-mcp/cache` 与 `temp`。不要安装全局包或下载另一份 Python。当前迁移复用了现有环境，没有调用安装或配音服务。

## 项目会话与发现

项目配置仅在客户端认可对应项目配置时生效。本地配置存在不等于当前桌面会话已自动接入，当前聊天无法热加载新增的子项目 MCP。源码启动器按自己的目录生成路径，为新 CLI 会话提供单次 MCP 参数，不修改全局 trust、sandbox、approval 或配置：

```powershell
# 在 Mechanism Studio 根目录，验证单次注册：
& '.\tools\blender-mcp\start-codex.ps1' -Verify
# 用户需要时启动新 CLI 会话：
& '.\tools\blender-mcp\start-codex.ps1'
```

迁移到其他位置后，启动器仍按目录生成绝对路径。本机 `.codex/config.toml` 如需直接加载，应在本地更新为该位置，不提交这份机器配置。

## 复验

```powershell
& '.\.tools\blender-mcp\.venv\Scripts\python.exe' -B '.\tools\blender-mcp\self_test.py'
& '.\tools\blender-mcp\scope-check.ps1'
```

自测真实初始化 stdio 客户端，确认四工具，执行 `status`、`inspect_lock` 与 overview 渲染，拒绝自由代码、路径、命令、未知机位和工具；核对整个资产和配音目录逐文件摘要不变。它不会调用重建或配音。范围检查临时在项目内建立指向父目录的 junction，确认拒绝后只移除这个链接，未读写父目录文件。日志保存在 `.tools/blender-mcp/logs/`。

2026-10-11 迁移验收：源码和运行环境分开，根目录从脚本位置推导；venv 实际导入 MCP 1.26.0 成功。6 项范围、摘要与并发检查通过，6 个非法协议请求被拒；真实检查得到 24 mesh / 24 part_id，overview 渲染 3.55 秒。父目录、兄弟项目和指向父目录的 junction 均被拒绝，未读写外部文件；建模源码、规格与 `.blend` 符合原审核摘要，音频符合原豆包清单，检查与渲染前后资产及配音逐文件摘要不变。没有执行重建或配音。

`start-codex.ps1 -Verify` 的单次注册已被本机 Codex 识别，路径指向当前独立项目根。迁移摘要、协议、junction 与 Python 验证分别记录在本地 `logs/migration-asset-check.json`、`protocol-check.json`、`reparse-check.json`、`runtime-relocation.json`。这些验证不代表当前桌面会话已接入。

参考：[官方 MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)、[官方 Codex MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[官方项目配置优先级](https://learn.chatgpt.com/docs/config-file/config-basic)。
