# SVG Editor Platform Phase 2 项目操作整理

> 用途：把本轮 Phase 2 的开发、验证、运行与常见问题整理成一份可执行文档，便于复现、汇报和继续开发。
> 详细过程见 [开发日志](2026-11-25-development-log.md)；验收结论见 [验收矩阵](../acceptance.md)；发布步骤见 [发布清单](../release-checklist.md)。

## 1. 项目概览

- 产品：事务式 SVG 编辑器 CLI（Phase 1）+ 插件化框架（Phase 2），另有 VSCode 扩展与 DSH 工具插件。
- 仓库：<https://github.com/zero0307/svg-editor-platform>
- 分支模型：

  | 分支                                                                                                      | 含义                                 | 状态                                                         |
  | --------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
  | `main`                                                                                                    | Phase 1 历史与初始化                 | 未合并 Phase 2，仍在 `545f6f7`                               |
  | `integration/phase2`                                                                                      | `main` 的副本，22 个节点全部合并于此 | 本地 `014efc6`；远端 `14a45d7`（最后一次文档提交因网络未推） |
  | `team/jia-core`、`team/yi-eng`、`team/bing-quality`、`team/ding-vscode`、`team/wu-dsh`、`team/ji-plugins` | 六位成员的功能分支                   | 已推送                                                       |
  | `evidence/p2-framework-base`、`evidence/box-code`、`evidence/box-config`                                  | 框架冻结与 A/B 接入证据              | 已推送                                                       |

- 进度：**22 / 22 节点完成**，需求矩阵 31 通过 / 4 部分通过 / 0 未执行。
- `p2` 标签：**未创建**（用户要求不合并 `main`，发布待确认）。
- 测试基线：根 **128** 项 + 工作区 **310** 项全绿；架构检查 11 包 / 257 源文件 / 119 跨包导入。

## 2. 环境与初始化

```powershell
cd E:\develop\svg-editor-platform
git switch integration/phase2     # 注意：main 上是 Phase 1，没有插件
npm ci                            # 干净安装（首次或切换分支后）
npm run build                     # 构建 packages/*、apps/*、plugins/* 与根测试
```

- Node：`>= 22`，本轮实测 `v26.13.0`；npm `12.2.1`；Windows 10 x64。
- VSCode（扩展验证）：`1.143.1`。
- DSH（插件验证）：`@deepseek-ai/dsh@0.2.2-rc.5`。

## 3. 目录结构

```text
packages/
  core/        四扩展点、领域、事务、展示、事件、端口、fake
  svg-xml/     中立语法入口 parseSvgSyntax + 严格 XmlSvgCodec
  host/        PluginInstaller/Loader、文件与目录适配器
  builtins/    六种图形 provider + 19 个 P1 命令
apps/
  cli/         REPL、CommandDispatcher、A/B 组合根
  vscode-svg/  文件标记 + Outline + VSIX 打包
  dsh-plugin/  svg_inspect + svg_create_flowchart
plugins/
  command-stats/  command-dir/  shape-box/  tree-modified/
test/          Phase 1 回归、基线回放、组合根与插件集成测试
doc/           报告、ADR、验收证据、记录
docs/metrics/  Git 历史指标（脚本生成）
scripts/       baseline / metrics / assembly / 架构与文档检查
```

## 4. 六位成员与工作范围

| 成员 | 角色          | 节点（提交 SHA）                                                                   | 主要交付                                                                                                 |
| ---- | ------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 甲   | 框架核心      | #2 `4ae88aa`、#7 `23f85a5`、#10 `0773e43`、#14 `2d16341`                           | 四扩展点契约、候选事务、树展示、builtins/CLI 迁移；框架补丁 `4f41183`（目录端口）、`df4fd1d`（多态反馈） |
| 乙   | 工程/宿主/XML | #5 `4052720`、#6 `4ee1330`、#9 `0e97a66`、#8 `11baca4`、#13 `b8a463b`              | workspaces 与包边界、中立语法、IO 适配器、加载器、严格 codec                                             |
| 丙   | 集成质量      | #1 `20ee5ac`、#12 `a7a34a0`、#15 `29f51c4`、#21 `f07993a`、#22 `412727f`+`39381af` | 基线 golden、指标脚本、F 冻结、A/B 证据、收口报告与发布清单                                              |
| 丁   | VSCode        | #3 `ca80c0b`、#11 `872185d`；#2 复核 `75a3911`                                     | 文件标记、Outline、VSIX、真实宿主截图                                                                    |
| 戊   | DSH           | #4 `63e6c89`、#16 `8c7ea05`                                                        | 最小插件、两个 SVG 工具、干净目录安装                                                                    |
| 己   | 插件 C/B/T    | #17 `39d503f`、#18 `4073ab7`、#19 `0df080b`、#20 `1334319`                         | stats、dir、box、modified-star 四个独立插件                                                              |

每个节点的完成物都包含：实现 + 测试 + `doc/evidence/acceptance/NNN-<key>.md` 验收文档。

## 5. 运行 CLI

### 5.1 交互模式

```powershell
npm run cli
```

```text
svg> init 400 300
svg> create box n1 120 100 160 60 "开始"
svg> create rect r 10 10 20 20 red
svg> move n1 0 10
svg> tree
svg> stats
svg> dir
svg> save artifacts/smoke.svg
```

实测关键输出：

```text
canvas 400x300 created
box#n1 created (g#n1 + rect#n1-rect + text#n1-label)
rect#r created
box#n1 moved by (0,10)
svg (400x300) *
├── g#n1 (box) *
│   ├── rect#n1-rect  x=120 y=110 w=160 h=60 fill=#4a90d9 *
│   └── text#n1-label  (140,145) "开始" *
└── rect#r  x=10 y=10 w=20 h=20 fill=red *
rect: 2  text: 1  (total 3, containers 1)
```

- `(box)` 来自 `shape-box` 插件；行尾 `*` 来自 `tree-modified` 插件。
- 退出交互：Windows 按 `Ctrl+Z` 再回车；Git Bash/WSL/macOS/Linux 按 `Ctrl+D`；`Ctrl+C` 可强制退出。
- 交互模式没有 `exit` 命令——该需求已登记为合并前待办（见第 10 节）。

### 5.2 脚本模式

`--script` 接收命令文本文件（每行一条命令，`#` 为注释），仓库自带示例：

```powershell
node apps/cli/dist/main.js --script examples/transforms.commands
node apps/cli/dist/main.js --script examples/flowchart.commands
node apps/cli/dist/main.js --script examples/history.commands
```

自定义脚本：

```powershell
@'
init 400 300
create box n1 120 100 160 60 "开始"
create box n2 520 100 160 60 "处理数据"
create line l 280 130 520 130 black
tree
save artifacts/flow.svg
'@ | Set-Content -Encoding utf8 artifacts\demo.txt

node apps/cli/dist/main.js --script artifacts\demo.txt
```

- 路径以当前工作目录为基准，建议在仓库根运行。
- 任一命令报错仍继续执行，但退出码为 1。

### 5.3 A/B 两种装配

| 模式               | 命令                                                      | 说明                                               |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------- |
| A 代码装配（默认） | `npm run cli`                                             | 代码内显式 import 四个可选插件                     |
| B 配置装配         | `node apps/cli/dist/main.js --config plugins.config.json` | 按配置加载，顺序 stats → dir → box → tree-modified |

关闭全部可选插件（回到 Phase 1 能力）：

```powershell
node apps/cli/dist/main.js --config test/fixtures/plugins/no-optional-plugins.json
```

此时 `stats`/`dir` 报 `error: unknown command`，`create box` 报 `unknown shape type: box (is the plugin loaded?)`。

> 用 npm 传参要加 `--`：`npm run cli -- --config plugins.config.json`。

## 6. 测试与验证

```powershell
npm test              # 根测试 128 项（Phase 1 回归 + 基线 + 组合根/插件集成）
npm run test:packages # 各包/插件测试 310 项
npm run check         # 格式 + 文档链接 + 测试 + 架构边界检查
npm run verify:visual # 渲染对比（differingChannels: 0）
```

单包：`npm test -w @svgframe/core`（同理 `svg-xml`、`host`、`builtins`、`vscode-svg`、`dsh-plugin`、四个插件）。

## 7. VSCode 扩展

```powershell
cd apps\vscode-svg
npm run build        # tsc + esbuild，产出 dist/extension.js
```

- **调试**：VS Code 打开 `apps/vscode-svg`，按 `F5`（`.vscode/launch.json` 自动打开 `examples/`）。
  - Explorer 中 `.svg` 文件显示 `[]` 标记；
  - 打开 `examples/nested/groups.svg`（文本编辑器）；
  - `Ctrl+Shift+P` → `Outline: Focus` 查看原生大纲，点击符号跳到开始标签。
- **打包**：

  ```powershell
  npm run package -w vscode-svg
  # 产物：apps/vscode-svg/dist/svgframe.vscode-svg.vsix
  ```

- **安装**（注意当前目录）：

  ```powershell
  # 在 apps/vscode-svg 目录下
  code --install-extension dist/svgframe.vscode-svg.vsix

  # 或在仓库根目录
  code --install-extension apps/vscode-svg/dist/svgframe.vscode-svg.vsix
  ```

  验证：`code --list-extensions | Select-String svgframe`；卸载：`code --uninstall-extension svgframe.vscode-svg`。

- 真实截图与安装日志：`doc/evidence/vscode/`。

## 8. DSH 插件

- 固定版本 `@deepseek-ai/dsh@0.2.2-rc.5`；插件包 `apps/dsh-plugin`。
- 运行/安装步骤与证据：`doc/dsh.md`、`doc/evidence/dsh/install/README.md`。
- 两个工具：`svg_inspect`（读 SVG 返回画布/结构/类型统计）、`svg_create_flowchart`（按节点/连线生成并保存 SVG）。
- 限制：真实模型侧调用需要 `DEEPSEEK_API_KEY`，当前环境未配置，只验证了插件加载、工具注册与卸载。

## 9. 开发流程（本轮采用）

1. 从 `main` 建立集成分支副本 `integration/phase2`，不合并 `main`。
2. 每位成员一个长期分支 `team/*`。
3. 严格按 `depends_on` 拓扑顺序开发；每个节点一个提交 + 一份验收文档。
4. 开发子智能体只在自己的分支提交；负责人逐节点 `git merge --no-ff <节点提交>` 到集成分支，跑 `npm run check`，再推送成员分支与集成分支。
5. 插件节点发现框架缺口时先报告，由框架负责人做独立补丁提交，不在插件接入提交里改内核。
6. 需要 A/B 接入证明时，从框架冻结基线 F 建立 `evidence/*` 分支，保存 C_A/C_B 与零改动检查。

## 10. 已遇到的问题与处理

| 现象                                                                           | 原因                                                       | 处理                                                                                          |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `create box` 报 `unknown shape type`                                           | 在 `main` 分支运行（Phase 1 无插件），或用了空插件配置     | 切到 `integration/phase2`；或不要带 `--config test/fixtures/plugins/no-optional-plugins.json` |
| 同样报错但分支正确                                                             | 用了 B 模式且配置缺少 `@svgframe/shape-box`                | 用根 `plugins.config.json`，或补上该条配置                                                    |
| `--script examples/README.md` 报 `cannot read script`                          | 该文件不存在；`--script` 需要命令文本文件                  | 使用 `examples/*.commands` 或自建 `.txt` 脚本                                                 |
| `code --install-extension` 报 `ENOENT ...\apps\vscode-svg\apps\vscode-svg\...` | 已 `cd` 到 `apps/vscode-svg`，路径前缀重复                 | 用 `dist/...` 相对路径，或回仓库根用完整相对路径                                              |
| 中文文档/脚本出现乱码                                                          | PowerShell `Get-Content/Set-Content` 按 ANSI 读写          | 用编辑器工具或 Node 以 UTF-8 写入                                                             |
| `npm ci` 警告两个 postinstall 被跳过                                           | 环境 `allowScripts` 策略拦截 `esbuild`/`@vscode/vsce-sign` | 不影响测试与打包，已记录在证据中                                                              |
| 想退出 `svg>` 会话                                                             | 没有 `exit` 命令                                           | `Ctrl+Z`+回车（Windows）或 `Ctrl+D`；`exit` 已列为合并前待办                                  |
| `C_A`/`C_B` 在 F 上无法构建                                                    | 插件实现用到 F 之后新增的 `creationParts()` 钩子           | 仅作 diff 证据；可改用 `0df080b` 的旧实现或纳入新 F′ 后重建                                   |

## 11. 验收、证据与指标

- 验收矩阵：`doc/acceptance.md`（31 通过 / 4 部分通过 / 0 未执行）。
- 节点验收文档：`doc/evidence/acceptance/001`–`022`。
- 证据索引：`doc/evidence-index.md`。
- 真实提交证据索引：`doc/evidence/assembly/`（C_A/C_B diff、零改动检查、A/B 回放）。
- 框架冻结：`doc/evidence/framework/freeze.json`（F=`a21f758`）、扩展点清单。
- 最终指标（`final`=`e5621a6` → 候选）：

  | 分类        | 文件 | 行数 | 复杂度 |
  | ----------- | ---: | ---: | -----: |
  | kernel      |   61 | 2197 |    354 |
  | assembly    |   28 | 1910 |    482 |
  | plugin      |   67 | 1924 |    272 |
  | CLI 合计    |  156 | 6031 |   1108 |
  | vscode 单列 |   14 |  402 |     46 |
  | dsh 单列    |   11 |  724 |    100 |

  由 `node scripts/metrics/metrics.mjs --from 'final^{commit}' --to <rev> --out docs/metrics` 生成，规则与排除项见 `scripts/metrics/README.md`。

## 12. 合并与发布前待办

1. **`exit` 命令**：交互式 `svg>` 输入 `exit` 立即退出，脚本模式停止后续命令，`help` 列出 `exit`，需测试；详见 [开发日志 §12](2026-11-25-development-log.md)。
2. 合并 `main`、创建 `p2` 标签、推送（需用户确认）；步骤见 [发布清单](../release-checklist.md)。
3. 在 `p2` 上重跑指标并核对源码散列。
4. DSH 模型侧真实调用（需要 `DEEPSEEK_API_KEY`）。
5. 可选：重建可构建的 `C_A`/`C_B`；补跨平台/Node 22–24/CI 验证；渲染 PlantUML 图。

## 13. 相关文档

- [开发日志（最终）](2026-11-25-development-log.md)
- [课程报告入口](../README.md)
- [验收矩阵](../acceptance.md)
- [发布清单](../release-checklist.md)
- [证据索引](../evidence-index.md)
- [ADR 索引](../adr/README.md)
- [VSCode 文档](../vscode.md)
- [DSH 文档](../dsh.md)
- [dir 命令文档](../dir.md)
