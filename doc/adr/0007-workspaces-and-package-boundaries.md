# ADR-0007 npm workspaces、构建顺序与包边界检查

状态：Proposed  
日期：2026-11-24  
关联：Issue #5（TASK-ENG-01）；需求条目 BASE-01、BASE-02、EXT-01；消费者 #6、#7、#8、#9、#10、#13、#14、#17~#20

## 背景

#2 已交付 `@svgframe/core` 的公开契约与测试替身，#1、#3、#4 也已在 `packages/` 与 `apps/` 下建立可独立构建的包。此前各包用各自的 `tsc -p` 编译，仓库没有 workspaces、统一的跨包依赖校验或单包/全仓测试入口；根 `npm run check` 只覆盖旧的 `src/`、`test/`。后续 #6、#8、#9、#13 会持续新增包，若不在框架阶段一次固定包布局、构建顺序和边界检查，各节点会各自发明入口与依赖方向。

本 ADR 只记录工程地基决策，不代表插件框架、加载器或 CLI 迁移已经完成；旧 `src/` 运行代码仍保留到 #14。

## 决策

### 1. npm workspaces

- 根 `package.json` 增加 `"workspaces": ["packages/*", "apps/*", "plugins/*"]`；`plugins/` 尚无实际包，只预先声明 glob，不创建空包。
- 只创建有实际实现的包；包名与目录的对应关系以各包 `package.json` 的 `name` 为准，不按目录名推测。
- 现有包名保持：`@svgframe/core`、`vscode-svg`（VSCode 扩展的 `name` 不能带 scope）、`@svgframe/dsh-plugin`。后续按编排记录使用 `@svgframe/svg-xml`、`@svgframe/host`、`@svgframe/builtins`、`@svgframe/cli` 与插件名。
- 工作区内部依赖在 `package.json` 中声明为 `"*"`，由 npm 链接到本地目录；不使用 npm 不支持的 `workspace:*`。版本不因内部依赖互相牵制，锁文件只增加 workspace link 条目。
- 不新增运行时/开发依赖；esbuild、vsce、`@types/vscode` 等属于 #11，由对应节点自行添加并说明。

### 2. 包布局

`packages/*` 库包沿用 #2 已确定的布局，不强制改成 `src/`：

- 公开入口是包根的 `index.ts`，唯一 `exports["."]` 指向 `dist/index.js`，类型指向 `dist/index.d.ts`；子路径（`./src/*`、`./dist/*`）不对外暴露。
- `tsconfig.json` 继承根 `tsconfig.json`，设 `rootDir: "."`、`outDir: "dist"`、`declaration: true`；测试放包根 `test/`，与源码一起编译到 `dist/test/`。
- 库包启用 `composite: true` 与 `tsBuildInfoFile: "dist/.tsbuildinfo"`，以便被项目引用和增量构建。
- 包内 `build` 脚本为 `tsc -b .`，因此单包构建会自动先构建它引用的项目；`test` 脚本先 `npm run build` 再跑 `node --test "dist/test/*.test.js"`，保证从干净安装直接可用。

`apps/*` 保持产品自己的入口与形态：

- `apps/vscode-svg` 继续 `src/` + `dist/src`，`main` 指向扩展入口；当前不引用任何内部包，后续接入 `@svgframe/svg-xml` 时只允许该依赖。它不是库包，暂不加入项目引用，`test` 脚本自行先构建。
- `apps/dsh-plugin` 是 JS 包（`index.js`/`index.d.ts` + 测试），没有 `tsconfig`，不参与 TypeScript 构建；允许暂时没有任何内部依赖，未来运行装配可引用 core/svg-xml/host/builtins。
- `apps/cli`（#14 建立）与库包一样加入项目引用与依赖矩阵。

### 3. 构建顺序

- 根新增 `tsconfig.build.json`：`files: []`，`references` 只列有 TypeScript 构建的库包（当前 `packages/core`）。`npm run build:packages` = `tsc -b tsconfig.build.json`，由 TypeScript 的引用图拓扑排序，后加入的包只需追加一条 reference。
- 已用 TypeScript 7.0.2（原生 tsgo）验证 `composite` + `tsc -b` 可用：core 编译出 `dist/index.d.ts` 与 `dist/test/*.js`，另一个引用它的包通过 `@svgframe/core` 包名解析到 `dist/index.d.ts` 并成功构建。因此不采用“脚本逐包 `tsc -p`”的降级方案。
- `npm run test:packages` = 先 `build:packages`，再 `npm test --workspaces --if-present`；每个 workspace 的 `test` 脚本自带构建，所以单包 `npm test -w @svgframe/core` 与全仓命令都可用。
- 旧入口语义不变：`npm run build`、`npm test`、`npm run cli`、`npm run verify:visual` 仍只编译/运行旧的 `src/`、`test/`，输出路径仍是 `dist/src`、`dist/test`。
- 根 `npm run check` 顺序固定为：format:check → check:docs → 旧 `npm test`（89 项回归）→ `build:packages` → `test:packages` → `node scripts/check-architecture.mjs`。

### 4. 依赖矩阵与检查

`scripts/check-architecture.mjs` 同时保留旧的 `src/` 分层规则（domain/application/cli/infrastructure/bootstrap 方向、一类一文件、禁止 tag/type switch）并新增 workspace 检查：

| 包/区域             | 允许 import 的内部包                            | 其他约束                                     |
| ------------------- | ----------------------------------------------- | -------------------------------------------- |
| `packages/core`     | 无                                              | 禁 `node:*`、`@xmldom/xmldom`、Node 全局对象 |
| `packages/svg-xml`  | `@svgframe/core`                                | 禁 `node:*`（测试文件除外）                  |
| `packages/host`     | `@svgframe/core`                                | 允许 Node 内置模块                           |
| `packages/builtins` | `@svgframe/core`                                | 禁 `node:*`（测试文件除外）                  |
| `plugins/*`         | `@svgframe/core`                                | 禁 `node:*`（测试文件除外），插件互不导入    |
| `apps/cli`          | core、host、svg-xml、builtins、已存在的 plugins | A 组合根可显式引用插件                       |
| `apps/vscode-svg`   | `@svgframe/svg-xml`                             | `vscode` 为宿主环境模块；当前无内部依赖      |
| `apps/dsh-plugin`   | core、svg-xml、host、builtins                   | JS 包，当前无依赖；外部 import 不强制声明    |

检查规则：

- 由根 `workspaces` 展开实际目录并读取各包 `name`；未登记依赖规则的包直接失败，迫使新包评审时同步更新矩阵。
- 相对 import 不得解析到包目录之外；`@svgframe/*` 只能 import 包根，且必须同时在 `package.json` 依赖中声明。
- core/svg-xml/builtins/plugins 的非测试源码不得 import Node 内置模块；core 额外禁止 XML DOM 与 `process.`/`Buffer.` 等 Node 全局。
- `packages/*` 必须 ESM、必须有 `exports["."]` 的 `types` 与运行时入口；一类一文件与 tag/type switch 限制推广到各 workspace 源码。
- 检查脚本读取 `package.json` 时剥离 UTF-8 BOM，避免 Windows 工具写入 BOM 时崩溃。

### 5. 文档与锁文件

- 新的工作区命令只写进真实可执行的文档：[repository-layout.md](../repository-layout.md)、[CONTRIBUTING.md](../../CONTRIBUTING.md)、根 `README.md` 的状态说明与 ADR 索引。
- `package-lock.json` 与根 `package.json` 同提交更新，保持 `lockfileVersion: 3`；`npm ci` 是干净安装的验收命令。
- `*.tsbuildinfo` 只是本地增量构建缓存，不提交。

## 备选与取舍

- **用脚本逐包 `tsc -p` 并按拓扑排序**：不依赖 `composite`，但需要自己维护包间顺序，且失去项目引用的增量与失效检测。TypeScript 7.0.2 的 spike 已证明 `tsc -b` 可用，故选项目引用。
- **让所有 workspace（含 apps）进入同一个 solution**：需要把 `apps/vscode-svg` 改成 `composite` 并强制 `declaration` 输出，而该扩展后续可能改用打包器（#11），改动会立刻过期。故 solution 只收库包，apps 由自己的 `build`/`test` 脚本构建。
- **`@svgframe/*` 依赖写具体版本**：会让每个内部版本变更都波及所有包；写 `"*"` 由 workspace 链接承担版本管理，符合当前同仓同版本的阶段。
- **使用 pnpm/yarn workspaces**：课程与现有工程要求保留 npm 与锁文件，不更换包管理器。
- **只在 `check` 里跑旧回归**：无法在合并门槛发现新包的构建/测试与依赖方向问题；本决策把工作区纳入 `check`，代价是合并检查变慢，但换来单入口一致性。

## 验证

本节点真实执行（详见 [Issue #5 验收证据](../evidence/acceptance/005-eng-01.md)）：

- `npm install --prefer-offline`：生成 workspaces 锁条目与 `node_modules/@svgframe/core`、`@svgframe/dsh-plugin`、`vscode-svg` 链接。
- `npm ci --prefer-offline`：干净安装成功。
- `npm run build:packages`（`tsc -b tsconfig.build.json`）：通过，core 产出 `dist/index.d.ts` 与 `dist/test/*.js`。
- `npm run test:packages`：core 50、dsh-plugin 7、vscode-svg 7，合计 64 项通过；旧 `npm test` 89 项通过。
- `node scripts/check-architecture.mjs`：旧 38 个文件/115 条内部 import 通过；3 个 workspace、76 个源文件通过。另用临时探针验证跨包相对路径、未声明依赖、禁止依赖与 core 的 Node/XML 禁用规则均会失败，探针已删除。
- TypeScript 7.0.2 spike：`tsc -b` 构建 composite 包，并由消费者包通过 `@svgframe/core` 成功引用（临时目录，不提交）。

未执行/已知差距：`build:packages` 目前只覆盖库包（当前仅 core），apps 由各自脚本构建；`apps/*` 的依赖矩阵条目要在 #11/#14/#16 接入时真正生效；Node 26.13.0 是本机版本，`.nvmrc` 仍固定 24.22.1，CI 矩阵仍为 22/24。

## 受影响消费者

| 消费者     | 约定                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #6 svg-xml | 新建 `packages/svg-xml`：继承根 tsconfig、`rootDir "."`、`composite`、包根 `index.ts`、`exports["."]`；`references: [../core]`，声明 `@svgframe/core: "*"`；在 `tsconfig.build.json` 追加 reference；包根 `test/` 编译到 `dist/test/`。 |
| #8 host    | 同上，另加 Node 内置模块使用；loader 不得 import 具体插件。                                                                                                                                                                             |
| #9 host    | 若 `packages/host` 尚未建立，则由本节点建立包骨架（package.json/tsconfig/index/adapters）并登记 solution；后续 #8 只新增 loader 文件与测试，不再改工作区配置。                                                                          |
| #13 xml    | 在 svg-xml 内新增严格 codec，通过 core 公开入口使用 provider；不得反向依赖 core 之外。                                                                                                                                                  |
| #11 vscode | 若接入 svg-xml，在 `apps/vscode-svg/package.json` 声明 `@svgframe/svg-xml: "*"`，并只在矩阵允许范围内 import；扩展保持自己的构建脚本。                                                                                                  |
| #14 cli    | 新建 `apps/cli`，加入依赖矩阵；若仍以 tsc 构建则加入 `tsconfig.build.json` 的 solution。把日常入口迁出旧 `src/` 时同步删除旧测试断言不得早于迁移提交。                                                                                  |
| 插件节点   | 只依赖 `@svgframe/core` 包根；在 `plugins/*` 下新建包时无需修改检查脚本。                                                                                                                                                               |

## 后续

- 每次新增包时在 `tsconfig.build.json` 与依赖矩阵中登记，不复制这套配置说明。
- #14 移除旧 `src/` 后，`npm test` 与根 `tsconfig.json` 的目标需重新定义；届时新增 ADR 或更新本 ADR 状态。
- 干净克隆 + `npm ci` 的验证纳入 #15 框架冻结证据，避免只在开发机成立。
