# CLI 指标：final^{commit} → 17f9a78

本文件由 `scripts/metrics/metrics.mjs` 从 Git 历史生成，不接受手改；同一输入 SHA 与工具版本生成相同字节。

| 输入 | 值 |
| --- | --- |
| 基线 rev | `final^{commit}` |
| 基线标签对象 | `—` |
| 基线提交 | `e5621a68afd4731626d54566f17ba55885d1bc0f` |
| 目标 rev | `17f9a78` |
| 目标提交 | `17f9a7850d685750dd8c6ea684c23530219a6b9d` |
| 规则版本 | 1 |
| 解析器 | `typescript/unstable/sync (syntax-only AST)`（TypeScript 7.0.2，Node v26.13.0） |
| 分类表 | `scripts/metrics/classification.json`（sha256 3e63d328d281） |
| 生成命令 | `node scripts/metrics/metrics.mjs --from final^{commit} --to 17f9a78 --out docs/metrics` |

## 三类 CLI 指标

| 分类 | 文件(旧) | 文件(新) | 文件增量 | 行数(旧) | 行数(新) | 行数增量 | 复杂度(旧) | 复杂度(新) | 复杂度增量 | 函数数(新) | 最大单元(新) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kernel | 28 | 86 | +58 | 921 | 3027 | +2106 | 246 | 589 | +343 | 341 | 16 |
| assembly | 10 | 25 | +15 | 686 | 1744 | +1058 | 212 | 473 | +261 | 162 | 20 |
| plugin | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| vscode | 0 | 5 | +5 | 0 | 141 | +141 | 0 | 22 | +22 | 11 | 4 |
| dsh | 0 | 2 | +2 | 0 | 163 | +163 | 0 | 27 | +27 | 13 | 6 |
| CLI 合计 | 38 | 118 | +80 | 1607 | 5075 | +3468 | 458 | 1111 | +653 | 527 | 20 |

范围：38 → 118 个源文件（各提交跟踪 80 → 344 个文件）。VSCode 与 DSH 单列，不计入 CLI 合计。

## 目标提交中复杂度最高的文件（前 10）

| 文件 | 分类 | 行数 | 复杂度 | 函数数 | 最大 |
| --- | --- | ---: | ---: | ---: | ---: |
| `packages/svg-xml/syntax/SvgSyntaxParser.ts` | assembly | 258 | 83 | 17 | 12 |
| `src/infrastructure/XmlSvgCodec.ts` | assembly | 185 | 70 | 21 | 20 |
| `packages/host/loader/PluginInstaller.ts` | assembly | 257 | 55 | 26 | 16 |
| `packages/host/loader/PluginLoader.ts` | assembly | 159 | 53 | 14 | 16 |
| `packages/core/services/StructureService.ts` | kernel | 135 | 43 | 9 | 16 |
| `packages/core/presentation/TreePresenter.ts` | kernel | 162 | 41 | 17 | 7 |
| `src/cli/CommandRouter.ts` | assembly | 148 | 38 | 24 | 9 |
| `packages/core/domain/SvgDocument.ts` | kernel | 99 | 29 | 19 | 6 |
| `src/domain/SvgDocument.ts` | kernel | 87 | 29 | 19 | 6 |
| `packages/core/domain/Shape.ts` | kernel | 88 | 27 | 20 | 4 |

## 迁移表（旧路径 → 新路径）

| 旧路径 | 新路径 | 分类变化 | from 存在 | to 存在 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `src/application/CommandHistory.ts` | `packages/core/services/EditHistory.ts` | kernel → kernel | true | true | both |
| `src/application/ShapeFactory.ts` | `packages/builtins` | kernel → plugin | true | false | pending |
| `src/application/SvgEditor.ts` | `packages/core/services/EditorSession.ts` | kernel → kernel | true | true | both |
| `src/application/commands` | `packages/builtins` | kernel → plugin | true | false | pending |
| `src/application/ports` | `packages/core/ports` | kernel → kernel | true | true | both |
| `src/bootstrap` | `apps/cli` | assembly → assembly | true | false | pending |
| `src/cli` | `apps/cli` | assembly → assembly | true | false | pending |
| `src/cli/CommandRouter.ts` | `packages/core/extensions/CommandRegistry.ts` | assembly → kernel | true | true | both |
| `src/cli/ShapePresenter.ts` | `packages/core/presentation/TreePresenter.ts` | assembly → kernel | true | true | both |
| `src/domain/SvgDocument.ts` | `packages/core/domain/SvgDocument.ts` | kernel → kernel | true | true | both |
| `src/domain/shapes` | `packages/builtins` | kernel → plugin | true | false | pending |
| `src/domain/shapes/Group.ts` | `packages/core/domain/ContainerShape.ts` | kernel → kernel | true | true | both |
| `src/domain/shapes/Shape.ts` | `packages/core/domain/Shape.ts` | kernel → kernel | true | true | both |
| `src/infrastructure/LocalFileStore.ts` | `packages/host/adapters/LocalFileStore.ts` | assembly → assembly | true | true | both |
| `src/infrastructure/SvgTransform.ts` | `packages/svg-xml` | assembly → assembly | true | false | pending |
| `src/infrastructure/XmlSvgCodec.ts` | `packages/svg-xml` | assembly → assembly | true | false | pending |

搬目录不算消除复杂度：迁移期间旧路径与新路径同时存在时，两类都会计入指标。

## 排除项

| 模式 | 文件数(旧) | 文件数(新) |
| --- | ---: | ---: |
| `test/**` | 8 | 40 |
| `**/test/**` | 0 | 41 |
| `package-lock.json` | 1 | 1 |
| `**/package.json` | 1 | 6 |
| `**/tsconfig*.json` | 1 | 6 |
| `doc/**` | 11 | 82 |
| `.github/**` | 0 | 7 |
| `ci/**` | 2 | 1 |
| `examples/**` | 8 | 8 |
| `**/examples/**` | 0 | 8 |
| `scripts/**` | 2 | 9 |
| `**/*.md` | 2 | 5 |
| `**/*.d.ts` | 0 | 2 |
| `**/*.yml` | 0 | 1 |
| `**/.vscode/**` | 0 | 1 |
| `**/.vscodeignore` | 0 | 1 |
| `.*` | 6 | 7 |

规则口径：

- lines: physical lines; empty file is 0; a trailing newline does not add a line; blank and comment lines count
- complexity unit: function declaration, method, constructor, getter, setter, function expression, arrow function
- complexity base: 1 per unit; +1 for if, for, for-in, for-of, while, do, catch, conditional (?:), non-default case, &&, ||, ??
- complexity nested units: a nested function is its own unit and does not add its increments to the outer unit
- complexity report: sum over units (total), unit count (functions), largest unit (max); files without units report 0

产物：`docs/metrics/e5621a6-to-17f9a78.json`；逐文件指标见同名 JSON。
