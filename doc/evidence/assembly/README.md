# 插件接入差异与完整 A/B 回放（TASK-QA-02 / Issue #21）

## 1. 被测提交

| 角色 | 引用                  | 完整 SHA                                   | 说明                                                    |
| ---- | --------------------- | ------------------------------------------ | ------------------------------------------------------- |
| F    | `a21f758`             | `a21f758bf072a7d8c0ff683bc579db124c6d209d` | 框架冻结提交（受保护分支 `evidence/p2-framework-base`） |
| C_A  | `evidence/box-code`   | `d3465f73a5d5309bed04322c75504b9a953c8064` | 父 = F；改代码方式接入 box                              |
| C_B  | `evidence/box-config` | `043a2f763320f1066a6718febfb2779768052c88` | 父 = F；改配置方式接入 box                              |
| I    | `d2b5e23`             | `d2b5e236cd059c6e15ff9de6c46062620ab2da4e` | 完整集成提交（含 #14–#20 与两处框架补丁），A/B 回放对象 |

`sha.json` 由脚本从 `git rev-parse` 生成，并校验 `C_A^ = C_B^ = F`。证据分支只提交、不合并、不打 tag；远程推送由负责人完成，因此“新克隆检出 C_A/C_B”尚未在本节点验证。

## 2. 接入差异（C_A / C_B）

| 提交 |                                        新增插件文件 | 运行源码                                                            | 配置                                                                                                   | 元数据                                                                                                                                                                                  |
| ---- | --------------------------------------------------: | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C_A  | 17（`plugins/shape-box/**`，与 #19 实现逐字节相同） | 只改 `apps/cli/src/main.ts`（import + 一个 `embeddedPlugins` 数组） | 不变                                                                                                   | `apps/cli/package.json`（新增 `@svgframe/shape-box` 依赖，A 需要 import 解析）、`tsconfig.build.json`（新增 project reference）、`package-lock.json`（+12 行：workspace link 与包条目） |
| C_B  |                                      17（同一实现） | **零改动**                                                          | 只改 `plugins.config.json`（一条 `{ "module": "@svgframe/shape-box" }`，无 `options`、`enabled` 默认） | `tsconfig.build.json`（同一 reference）、`package-lock.json`（+11 行：workspace link 与包条目）                                                                                         |

完整 diff 见 `diff-C_A.txt`（54 656 B）与 `diff-C_B.txt`（52 988 B）。零改动检查（`zero-change-check.txt`，脚本全部输出 PASS）：

- `git cat-file -e C_A:{packages/core,packages/host,packages/svg-xml,packages/builtins,apps/cli/src/main.ts,plugins.config.json}` 全部存在；F 上 `plugins/` **不存在**，因为 F 是框架冻结提交，没有“既有插件”可保护，这一事实被明确记录，不用空 diff 冒充证明。
- `git diff C_A^ C_A -- packages ':(exclude)plugins/shape-box'` 为空；`git diff C_B^ C_B -- packages ':(exclude)plugins/shape-box'` 为空。
- `git diff C_A^ C_A -- plugins ':(exclude)plugins/shape-box'` 为空；C_B 同样为空。
- `git diff C_B^ C_B -- apps/cli` 为空；C_A 的 `apps/cli` 只含 `src/main.ts`（允许的顶层组合根）与 `package.json`（元数据）。
- 未改根 `package.json`：其 `workspaces` 已包含 `plugins/*`，无需改动。

## 3. C_A / C_B 无法在 F 上构建（真实失败，已按授权降级为 diff 证据）

在 C_A、C_B 上执行 `npm run build:packages` 都得到同一错误：

```text
plugins/shape-box/BoxShape.ts(53,12): error TS4113: This member cannot have an 'override' modifier because it is not declared in the base class 'Group'.
```

原因：`BoxShape.creationParts()` 是 #19 后续框架补丁 `df4fd1d`（`packages/core/domain/Shape.ts` 多态反馈）新增的钩子，位于 F 之后。授权范围不允许为了构建而修改 F 内核，因此 C_A/C_B 只作为**可复现的接入差异证据**，不在 F 上运行；运行期 A/B 在 I（含该补丁）上完成。原始日志：`build-C_A.log`、`build-C_B.log`（PowerShell 全流重定向保存为 UTF-16，此处转换为 UTF-8；未删除任何行）。

## 4. 完整 A/B 回放（I = `d2b5e23`）

同一编译入口 `apps/cli/dist/main.js`：A 用默认入口（`apps/cli/src/main.ts` 内嵌 4 个插件），B 用 `--config plugins.config.json`。插件集合/顺序/options 见 `compare.json` 的 `pluginSet`：`command-stats` → `command-dir` → `shape-box` → `tree-modified`，均无 options、默认 enabled。

| 会话      | transcript                          | A 退出码 | B 退出码 | stdout | 产物                         | 逐字节                            |
| --------- | ----------------------------------- | -------: | -------: | -----: | ---------------------------- | --------------------------------- |
| basic     | `doc/transcript/baseline-basic.txt` |        1 |        1 | 1189 B | `demo.svg`（413 B）          | 一致（stdout/stderr/退出码/产物） |
| box       | `doc/transcript/box.txt`            |        0 |        0 |  824 B | `flowchart-box.svg`（601 B） | 一致                              |
| stats-dir | `doc/transcript/stats-dir.txt`      |        0 |        0 |  304 B | 无                           | 一致                              |

- 每组 A/B 都在**隔离临时 cwd** 运行：`<work>/{a,b}/<session>/run`，运行前删除并按同一夹具重建；`stats-dir` 的 cwd 是 `test/fixtures/dir/tree` 的副本（tree sha256 记录在 `ab-stats-dir.log`），脚本与日志都在该目录之外。
- 不 trim、不排序、不删 warning/error；stdout/stderr 分别保存 sha256（见 `compare.json` 与 `ab-*.log`）。
- 顺序验证：同一 `init/help/tree` 输入经 A 与 B 运行，help 字节完全相同（715 B，sha256 `7d228bd053c4c848419fb8b7cffc4d458903a2105f41931e2998e3f1e733ba9f`），见 `ab-help.log`。help 按注册顺序列出命令与图形类型，因此这是对“集合/顺序/options 一致”的顺序敏感检查。

## 5. 关闭全部可选插件，回到 Phase 1 基线

用 `test/fixtures/plugins/no-optional-plugins.json`（`{"plugins":[]}`）在同一入口上：

- 四个 `final` golden 会话全部逐字节匹配：basic、flowchart、io、dir = **4/4**，退出码 1/0/1/1 与 golden 一致；
- 缺省行为检查全部通过：help 不含 `dir`/`stats` 命令与 `box` 类型；`stats`、`dir` 报 `unknown command`；`box` 报 `unknown shape type: box (is the plugin loaded?)`；错误退出码为 1。

详见 `ab-no-plugins.log` 与 `compare.json` 的 `noPlugins` 字段。

## 6. 复现

```bash
npm run build

node scripts/assembly/diff-evidence.mjs \
  --framework a21f758 --code evidence/box-code --config evidence/box-config --integration d2b5e23

node scripts/assembly/replay.mjs \
  --entry apps/cli/dist/main.js --config plugins.config.json \
  --integration d2b5e23 --out doc/evidence/assembly
```

环境：Windows `win32 x64`，Node `v26.13.0`（`.nvmrc` 为 24.22.1，差异已记录；未在 Node 22/24、Linux/macOS 或 CI 上运行）。

## 7. 文件

`sha.json`、`diff-C_A.txt`、`diff-C_B.txt`、`zero-change-check.txt`、`ab-basic.log`、`ab-box.log`、`ab-stats-dir.log`、`ab-help.log`、`ab-no-plugins.log`、`compare.json`、`build-C_A.log`、`build-C_B.log`。

## 8. 未执行

- 证据分支推送到远程与“新克隆检出 C_A/C_B”的独立验证（推送由负责人完成）。
- C_A/C_B 的运行验证（所需框架补丁在 F 之后，按授权不修改 F 内核）。
- 真实 VSCode/DSH 宿主与跨平台检查不属于本节点。
