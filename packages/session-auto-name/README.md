# 会话自动命名 / Automatic session names

每轮对话结束后，根据最近的人类消息生成简短主题，并将会话名称更新为 `[Nov7] 最新主题`。

- 通过 Harness 的 `sessionTitle` provider 更新持久化标题，侧边栏沿用原生标题显示。
- `all-prompts` 模式在有新的人类文本消息时安排更新；等待持久化 `turn/end`，不阻塞主回复。
- 日期采用轮次结束时间，默认 `Asia/Shanghai`；月份使用英文缩写。
- 默认沿用会话模型，选择其最低可用推理档位；每次额外请求最多 512 output tokens，可能产生费用。
- 最多选取最近 8 条人类文本消息、6000 字符，不上传图片、工具输出或思考内容。
- 生成失败时保留原名；新消息、手动重命名、会话卸载及插件卸载会取消旧任务。
- 手动重命名由原生服务固定，之后不自动覆盖。原生显式 refresh 可恢复自动命名。
- 不批量修改历史会话，不处理子代理标题。安装前已经开始的轮次不追溯触发，下一次新的人类输入生效。

## 安装与关闭

插件包名为 `dsh-session-auto-name`。在仓库根目录运行 `npm run pack:plugins` 生成 `dsh-session-auto-name-1.0.0.tgz`，再交给 Harness Plugin Manager 安装，或直接安装本目录。本 bundle 会禁用默认 `session-title-llm` provider，因为原生服务只允许一个 provider。

若已安装旧包 `dsh-sanshi-session-auto-name`，请先停用并移除旧 bundle，再安装新包。内部 entry/provider ID 保持不变，不要同时启用新旧两包。

在插件管理器关闭本插件即可停止更新。若需恢复默认首条消息命名，停用整个 bundle，或停用本插件后重新启用 `session-title-llm`。不要同时启用两个标题 provider。

## 配置

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `timeZone` | `Asia/Shanghai` | 日期采用的 IANA 时区 |
| `maxInputCharacters` | `6000` | 最近人类文本的字符预算，256–16000 |
| `maxTopicCharacters` | `32` | 主题字符上限，8–32 |
| `timeoutMs` | `30000` | 轮次结束后模型请求超时，1000–120000 毫秒 |

配置通过原生插件配置修改，不需要额外 API Key 或 `.env`：凭据继续由 Harness 模型服务管理。

## 验证

运行 `node --test test/*.test.js`。测试覆盖日期边界、标题清理、输入裁剪、会话隔离、轮次结束、取消与卸载、模型调用和错误结果。界面验证：安装后发起一轮非手动固定标题的会话，回复结束后观察侧边栏名称。

图标为本插件原创 SVG，采用 MIT 许可证。
