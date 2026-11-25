# Git 历史指标脚本（TASK-MET-01）

`scripts/metrics/` 只从 **Git 提交对象** 生成指标：不读工作区、不读构建产物、不读已安装依赖的旧版本。同一输入 SHA 与同一工具版本必须生成逐字节相同的结果，便于在 `#15`（框架冻结）与 `#22`（p2 收口）重跑核对。

## 命令

```bash
# 默认：final^{commit} → integration/phase2，输出到 docs/metrics/
node scripts/metrics/metrics.mjs

# 显式指定两端与输出目录（候选测量写到临时目录，避免报告 SHA 循环）
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to 17f9a78 --out docs/metrics
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to <candidate-sha> --out artifacts/metrics-candidate

# 单元/契约测试（10 项，含逐项复杂度、行数、分类失败与确定性）
node --test scripts/metrics/rules.test.mjs
```

产物：`docs/metrics/<from7>-to-<to7>.json`（逐文件与汇总）与 `docs/metrics/summary.md`（可读摘要）。JSON 里的 `command` 字段会记录 `--out`，因此“逐字节一致”的前提是同一组参数；换输出目录只应改变该字段。

## 指标口径（`RULES_VERSION = 1`）

| 指标       | 规则                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 行数       | 物理行数；空文件为 0；末尾换行不额外增一行；空行与注释计入，不另报“代码行”                                        |
| 复杂度单元 | 函数声明、方法、构造器、getter、setter、函数表达式、箭头函数，每个单元起点 1                                      |
| 累加项     | `if`、`for`、`for-in`、`for-of`、`while`、`do`、`catch`、三元条件、非 default 的 `case`、`&&`、`\|\|`、`??` 各 +1 |
| 嵌套单位   | 内层函数是独立单元，不把内层累加值加到外层；`do { } while ( )` 只算一个循环                                       |
| 汇总       | 每文件报 lines、complexity.total（所有单元之和）、functions（单元数）、max（最大单元）                            |

规则实现在 `rules.mjs`，语法树来自仓库锁定的 TypeScript 7.0.2；改规则必须同时升级 `RULES_VERSION`、更新 [ADR-0016](../../doc/adr/0016-metrics-rules-and-classification.md) 与本文件，否则不同版本的数字不可比。

## 分类与排除

- `classification.json` 维护 `glob → category → responsibility`：`kernel`（`packages/core`；旧 `src/domain`+`src/application`）、`assembly`（`packages/host`、`packages/svg-xml`、`apps/cli`；旧 `src/cli`/`src/infrastructure`/`src/bootstrap`）、`plugin`（`packages/builtins`、`plugins/*`）；`apps/vscode-svg` 单列 `vscode`、`apps/dsh-plugin` 单列 `dsh`，都不计入 CLI 合计。
- `excludes` 先于 `rules` 生效（测试、夹具、`dist`、`node_modules`、锁文件、`doc`/`docs`、`.github`、`ci`、`examples`、`scripts`、Markdown、包元数据与构建配置、类型声明等）。
- 校验：每个未被排除的文件必须**恰好命中一条** `rules`；0 条报 `no classification rule`，多条报 `matches N rules`，整次运行失败并列出全部问题。分类命中的文件必须是 `.ts/.tsx/.js/.mjs/.cjs`，否则要求补排除规则。
- 新增目录（例如 `packages/builtins` 落地、`apps/cli` 建立）必须先改 `classification.json`，否则脚本按设计失败；这是“文件职责不漏项”的强制点。

## 迁移表

`migration.json` 记录旧路径 → 新路径、分类变化与说明。脚本对两个被测提交分别检测 from/to 是否存在，输出 `moved` / `pending` / `both` / `neither`，用来区分“已搬迁”和“尚未搬迁”。旧路径与新路径同时存在时两边都计入指标，避免把搬目录当成复杂度消除。

## 解析器选型（实测）

TypeScript 7.0.2 是原生 tsgo 包，`createSourceFile` 不可用。实测 `typescript/unstable/sync` 可用：创建 API 27 ms、打开 `packages/core/tsconfig.json` 快照 87 ms，`Program.getSourceFile` 返回真实语法树，`forEachChild` 可遍历。因此脚本采用这条路径：

1. 用 `git show <commit>:<path>` 取出被测 blob；
2. 在系统临时目录按仓库相对路径落盘，生成只含 `files` 的最小 tsconfig（`noEmit`、`allowJs`）；
3. `API.updateSnapshot({ openProjects })` → 逐文件 `measureSourceFile`；
4. `api.close()` 并删除临时目录。输出只含仓库相对路径，不含临时目录。

备选“自写词法扫描器”未采用：需要自行处理正则/除法歧义与模板字符串嵌套，出错风险高于直接使用锁定版本的语法树；该备选仍可在 `unstable/sync` 未来不可用时替换 `ast.mjs`，规则与输出结构不变。若解析器不可用，脚本会以非零退出并给出明确错误，不会退化成猜测值。

## 已知限制

- 每个被测文件调用一次 `git show`（当前约 120 个文件，秒级）；没有改用 `cat-file --batch`。
- 依赖 `node_modules/typescript` 的 `unstable/sync` 入口与对应平台的 `@typescript/typescript-*` 原生包；`npm ci` 未安装该平台包时脚本失败而不是回退。
- 只在 Windows + Node v26.13.0 实测；其他平台未验证。
- 测试未接入根 `npm run check`，需要手动运行上面的 `node --test`；是否纳入 CI 由 `#15` 决定。
