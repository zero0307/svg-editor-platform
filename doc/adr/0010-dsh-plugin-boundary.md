# ADR-0010 DSH 插件与 CLI 插件边界

状态：Proposed  
日期：2026-11-24  
关联：Issue #4、#16；需求条目 DSH-01、PKG-02

## 背景

DSH 板块需要提供 `svg_inspect` 与 `svg_create_flowchart` 两个工具。DSH 的工具有自己的生命周期与清单（工具名、JSON Schema 输入输出、宿主注入的服务），与本项目 CLI 的 `PluginModule`/`contributes`/`activate` 形状不同。直接套用 CLI 插件契约会把两种宿主生命周期混在一起，也会让业务逻辑只能通过启动 CLI 子进程、解析终端文本验证。

## 决策

- `apps/dsh-plugin` 不是 CLI 插件：不使用四类 `contributes`，由 DSH 官方入口注册工具，并在卸载时释放注册与监听。
- 业务逻辑依赖公开的 `EditorSessionPort`/`SvgCodec` 抽象，可用 fake 端口独立测试；真实装配时复用 core/svg-xml/builtins 的同一套业务实现，不启动 CLI 子进程、不解析终端输出。
- 固定 DSH 发行版版本（版本号、Node 要求、安装命令与恢复方法写入 `doc/dsh.md`），版本变化视为需要重新验证的变更。
- 工具输入输出使用结构化对象与受支持的 JSON Schema 子集；文件访问走宿主注入的能力（例如 `ctx.fs`），不直接使用 Node 文件 API，避免绕过宿主的路径解析与写入策略。
- 运行依赖随包分发，可在无工作区链接的干净目录安装；真实安装与卸载证据写入 `doc/evidence/dsh/`。

## 备选与取舍

- 让 DSH 插件调用 CLI：无法复用领域服务、错误只能靠文本匹配，且引入子进程生命周期问题，放弃。
- 把两个工具做成 CLI 插件：与 DSH 生命周期不符，也违背“独立安装”的验收要求，放弃。

## 验证

- 待 #4/#16 落地后补充：最小插件加载/卸载无残留、fake `EditorSessionPort` 的业务测试、真实 DSH 会话的工具调用与 SVG 结果核对、干净目录安装记录。
- 真实 DSH 版本与 API 差异必须以实际安装为准；未实际执行的项目明确标注“未执行”，不以计划代替证据。

## 后续

DSH 官方 API 变化时更新本文并重新执行安装/卸载验证；若宿主不再支持所需注入能力，先补端口契约再改实现。
