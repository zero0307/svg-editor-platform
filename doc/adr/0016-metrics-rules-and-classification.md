# ADR-0016 指标规则、解析器与路径分类

状态：Proposed  
日期：2026-11-25  
关联：Issue #12；需求条目 MET-01、BASE-02、DOC-01

## 背景

课程要求 `docs/metrics/` 给出文件清单与职责、按 CLI 内核／装配处／插件三类的行数，以及相对 `final` 的圈复杂度增量，并明确“数字由脚本从 git 历史生成，脚本随仓库提交，不接受手填”。同时要求 VSCode 扩展单列、依赖与构建产物排除、迁移不能掩盖复杂度变化。仓库锁定的 TypeScript 7.0.2 是原生 tsgo 包，旧版 `ts.createSourceFile` 不再可用，因此需要先确定解析方式，再固定规则与分类，避免不同成员各自口径。

## 决策

1. 输入只来自 Git 对象：`git rev-parse` 解析两端提交、`git ls-tree` 枚举文件、`git show` 读取 blob；不读工作区或 `dist/`，因此未提交改动与本地构建不会改变数字。
2. 规则版本化：`rules.mjs` 中的 `RULES_VERSION = 1` 固定行数与复杂度口径（详见 `scripts/metrics/README.md` 与产物中的 `rules` 字段）。任何规则改动必须升级版本并重算，不同版本数字不比较。
3. 复杂度以函数／方法／构造器／getter／setter／函数表达式／箭头函数为单元，起点 1，对 `if`、四种循环、`catch`、三元、非 default `case`、`&&`、`||`、`??` 各 +1；内层单元独立计分，`do { } while ( )` 只算一个循环。每文件报 total／functions／max。
4. 解析采用仓库锁定的 TypeScript 7.0.2 的 `typescript/unstable/sync` 仅语法路径：把 Git blob 落到系统临时目录、生成最小 tsconfig、用一个快照逐文件取语法树。输出只记录仓库相对路径，结果不含临时目录。
5. 分类表与迁移表受版本控制：`classification.json` 维护 `glob → category → responsibility`，先排除后匹配；未被排除的文件必须恰好命中一条规则，0 条或多条都令运行失败。`migration.json` 记录旧路径 → 新路径与分类变化，脚本按两端检测存在性并输出 `moved`／`pending`／`both`／`neither`。
6. 输出确定性：JSON 与 Markdown 均按路径排序、无墙钟时间、无绝对路径；同一组参数两次运行逐字节一致。生成物加入 `.prettierignore`，避免格式化改变字节。

## 备选与取舍

- **手填数字或从报告抄数**：不可复算、容易与提交脱节，直接违反 MET-01，未采用。
- **引入独立 JS 解析器（如 Babel、旧版 TypeScript）**：需要新增运行时依赖并维护第二套解析配置，与本项目“锁文件、不随意加依赖”的约束冲突，未采用。
- **自写词法扫描器**：可以零依赖，但要自行处理正则字面量与除法的歧义、模板字符串嵌套、类型位置等情形，规则容易与真实语法树产生偏差；仅作为 `unstable/sync` 失效时的替换备选（替换 `ast.mjs`，规则与输出不变），本次未采用。
- **完整 tsc 程序或类型检查**：指标只需要语法结构，建立类型检查会显著变慢且引入依赖解析失败风险；本实现只用语法树，不读诊断。
- **把分类规则写进脚本代码**：路径变化需要改代码，评审看不到职责清单；改为受版本控制的 JSON，脚本只负责匹配与校验。
- **只按目录前缀粗分**：无法表达 `apps/vscode-svg`／`apps/dsh-plugin` 单列和未来 `plugins/*` 的插件归类；glob 规则可以逐条审查。
- **稳定性取舍**：`unstable/*` 属实验入口，升级 TypeScript 时可能变化；用 `RULES_VERSION`、产物中的 `tool.typescript` 与测试固定行为，升级需重跑并人工核对数字。

## 验证

- 单元／契约测试：`node --test scripts/metrics/rules.test.mjs`，10 项通过。覆盖每个 +1 项、注释/字符串/正则/模板不误计、空文件与末尾换行、嵌套单元独立、类成员与箭头、glob 语义、分类遗漏与重复失败、当前提交分类完整、两次运行字节一致。
- 真实运行：`node scripts/metrics/metrics.mjs --from 'final^{commit}' --to 17f9a78 --out docs/metrics`，产物 [docs/metrics](../../docs/metrics/README.md)。首版数字：kernel 28→86 文件、921→3027 行、复杂度 246→589；assembly 10→25 文件、686→1744 行、复杂度 212→473；plugin 0→0；VSCode、DSH 单列。
- 确定性：同一参数连续两次运行，JSON 与 `summary.md` 的 sha256 相同。
- 证据与逐条验收见 [012-met-01.md](../evidence/acceptance/012-met-01.md)。

## 后续

- `#15` 冻结框架时用同一命令生成 `final → F` 指标；`#22` 在 p2 候选上测量、提交报告后以收尾提交打 `p2`，再在 `p2` 上重跑核对 CLI 源码文件集合与散列一致。
- 若 `#15` 决定把指标测试纳入 CI，需要在根脚本中增加 `node --test scripts/metrics/`，并保证该环境安装了对应平台的 `@typescript/typescript-*` 原生包。
- 规则或分类变化时新增 ADR 或标注本 ADR 的 Superseded，不静默改写历史数字。
