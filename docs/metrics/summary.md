# CLI 指标：final^{commit} → a21f758

本文件由 `scripts/metrics/metrics.mjs` 从 Git 历史生成，不接受手改；同一输入 SHA 与工具版本生成相同字节。

| 输入 | 值 |
| --- | --- |
| 基线 rev | `final^{commit}` |
| 基线标签对象 | `—` |
| 基线提交 | `e5621a68afd4731626d54566f17ba55885d1bc0f` |
| 目标 rev | `a21f758` |
| 目标提交 | `a21f758bf072a7d8c0ff683bc579db124c6d209d` |
| 规则版本 | 1 |
| 解析器 | `typescript/unstable/sync (syntax-only AST)`（TypeScript 7.0.2，Node v26.13.0） |
| 分类表 | `scripts/metrics/classification.json`（sha256 39b9251f0a5b） |
| 生成命令 | `node scripts/metrics/metrics.mjs --from final^{commit} --to a21f758 --out docs/metrics` |

## 三类 CLI 指标

| 分类 | 文件(旧) | 文件(新) | 文件增量 | 行数(旧) | 行数(新) | 行数增量 | 复杂度(旧) | 复杂度(新) | 复杂度增量 | 函数数(新) | 最大单元(新) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kernel | 28 | 61 | +33 | 921 | 2170 | +1249 | 246 | 349 | +103 | 198 | 16 |
| assembly | 10 | 28 | +18 | 686 | 1886 | +1200 | 212 | 482 | +270 | 144 | 21 |
| plugin | 0 | 45 | +45 | 0 | 1218 | +1218 | 0 | 176 | +176 | 134 | 8 |
| vscode | 0 | 14 | +14 | 0 | 402 | +402 | 0 | 46 | +46 | 27 | 4 |
| dsh | 0 | 2 | +2 | 0 | 163 | +163 | 0 | 27 | +27 | 13 | 6 |
| CLI 合计 | 38 | 150 | +112 | 1607 | 5839 | +4232 | 458 | 1080 | +622 | 516 | 21 |

范围：38 → 150 个源文件（各提交跟踪 80 → 413 个文件）。VSCode 与 DSH 单列，不计入 CLI 合计。

## 目标提交中复杂度最高的文件（前 10）

| 文件 | 分类 | 行数 | 复杂度 | 函数数 | 最大 |
| --- | --- | ---: | ---: | ---: | ---: |
| `packages/svg-xml/syntax/SvgSyntaxParser.ts` | assembly | 272 | 84 | 17 | 12 |
| `packages/host/loader/PluginInstaller.ts` | assembly | 257 | 55 | 26 | 16 |
| `packages/host/loader/PluginLoader.ts` | assembly | 159 | 53 | 14 | 16 |
| `packages/core/services/StructureService.ts` | kernel | 135 | 43 | 9 | 16 |
| `packages/core/presentation/TreePresenter.ts` | kernel | 162 | 41 | 17 | 7 |
| `packages/svg-xml/strict/SvgImportNormalizer.ts` | assembly | 149 | 37 | 11 | 12 |
| `packages/svg-xml/strict/XmlSvgCodec.ts` | assembly | 112 | 33 | 10 | 21 |
| `packages/core/domain/SvgDocument.ts` | kernel | 99 | 29 | 19 | 6 |
| `packages/core/domain/Shape.ts` | kernel | 88 | 27 | 20 | 4 |
| `packages/core/domain/Group.ts` | kernel | 68 | 25 | 16 | 7 |

## 迁移表（旧路径 → 新路径）

| 旧路径 | 新路径 | 分类变化 | from 存在 | to 存在 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `src/application/CommandHistory.ts` | `packages/core/services/EditHistory.ts` | kernel → kernel | true | true | both |
| `src/application/ShapeFactory.ts` | `packages/builtins` | kernel → plugin | true | false | pending |
| `src/application/SvgEditor.ts` | `packages/core/services/EditorSession.ts` | kernel → kernel | true | true | both |
| `src/application/commands` | `packages/builtins` | kernel → plugin | true | true | both |
| `src/application/ports` | `packages/core/ports` | kernel → kernel | true | true | both |
| `src/bootstrap` | `apps/cli` | assembly → assembly | true | true | both |
| `src/cli` | `apps/cli` | assembly → assembly | true | true | both |
| `src/cli/CommandRouter.ts` | `packages/core/extensions/CommandRegistry.ts` | assembly → kernel | true | true | both |
| `src/cli/ShapePresenter.ts` | `packages/core/presentation/TreePresenter.ts` | assembly → kernel | true | true | both |
| `src/domain/SvgDocument.ts` | `packages/core/domain/SvgDocument.ts` | kernel → kernel | true | true | both |
| `src/domain/shapes` | `packages/builtins` | kernel → plugin | true | true | both |
| `src/domain/shapes/Group.ts` | `packages/core/domain/ContainerShape.ts` | kernel → kernel | true | true | both |
| `src/domain/shapes/Shape.ts` | `packages/core/domain/Shape.ts` | kernel → kernel | true | true | both |
| `src/infrastructure/LocalFileStore.ts` | `packages/host/adapters/LocalFileStore.ts` | assembly → assembly | true | true | both |
| `src/infrastructure/SvgTransform.ts` | `packages/svg-xml` | assembly → assembly | true | false | pending |
| `src/infrastructure/XmlSvgCodec.ts` | `packages/svg-xml` | assembly → assembly | true | false | pending |

搬目录不算消除复杂度：迁移期间旧路径与新路径同时存在时，两类都会计入指标。

## 排除项

| 模式 | 文件数(旧) | 文件数(新) |
| --- | ---: | ---: |
| `test/**` | 8 | 41 |
| `**/test/**` | 0 | 46 |
| `package-lock.json` | 1 | 1 |
| `plugins.config.json` | 0 | 1 |
| `**/package.json` | 1 | 8 |
| `**/tsconfig*.json` | 1 | 8 |
| `doc/**` | 11 | 96 |
| `docs/**` | 0 | 3 |
| `.github/**` | 0 | 7 |
| `ci/**` | 2 | 1 |
| `examples/**` | 8 | 8 |
| `**/examples/**` | 0 | 8 |
| `scripts/**` | 2 | 18 |
| `**/*.md` | 2 | 6 |
| `**/*.d.ts` | 0 | 1 |
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

产物：`docs/metrics/e5621a6-to-a21f758.json`；逐文件指标见同名 JSON。
