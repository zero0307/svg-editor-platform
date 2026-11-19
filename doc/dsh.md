# DeepSeek Harness SVG 插件

当前验收版为 0.2.0。在 DSH 会话中，`svg_layout_flowchart` 将节点与有向边排成流程图，`svg_create_flowchart` 根据节点坐标、标签和连线生成可编辑 SVG，`svg_inspect` 读回画布、按文档顺序排列的结构、类型统计和导入警告。工具使用该会话的工作目录和 DSH 文件服务。生成目标须为新 `.svg` 文件，同名文件由宿主原子保护。

## 先跑四节点 demo

具备 Node 24、仓库依赖和下文所列的 DSH、pnpm 后，在仓库根运行：

```sh
npm run demo:dsh
```

运行时真实创建 Agent，工作目录与宿主启动目录独立。它根据[输入文件](../apps/dsh-plugin/demo/review.json)依次调用布局、生成和检查工具。打开终端输出目录中的 `demo.svg`，从左到右应是「提交 → 评审／复核 → 通过」。在同目录的 `verification.json` 查看 `demo.inspected`，应为 4 个组、4 个矩形、4 个文本和 4 条线。修改输入后可运行 `npm run demo:dsh -- --input my-graph.json`。安装到自己的会话试用时，使用同目录中的 .tgz 和[插件使用说明](../apps/dsh-plugin/README.md)。

本次交付留存了[实际生成的 SVG](evidence/dsh/demo/demo.svg) 和[三工具验收结果](evidence/dsh/demo/verification.json)。

## 安装与使用

验证版本为官方 `@deepseek-ai/dsh@0.2.2-rc.5`、Node 24 和 pnpm 10。插件包带有 Phase 1 编辑运行时和 XML 编解码，DSH 提供工具注册表与文件服务。以下命令在项目根运行，要求 `dsh` 和 `pnpm` 在 PATH 中。使用独立的 `svg-demo` profile。[官方 bundle 安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)

```sh
npm ci
npm pack --workspace dsh-svg-editor --pack-destination .
dsh --profile svg-demo --from-default-profile sdk-minimal --dump-config
dsh plugin --profile svg-demo add ./dsh-svg-editor-0.2.0.tgz
dsh --profile svg-demo --dump-config
```

使用已有的 web profile 时，将上面的 `svg-demo` 换成 `web`，安装后以 `dsh web` 启动会话。可以提问“生成一张开始与结束两节点的流程图并保存为 demo.svg，再读回检查文字”。也可按下面的参数调用工具。每个节点的坐标对应矩形左上角，连线根据两端节点中心绘制在矩形下方。直线连接要求端点为两个不同节点。

```json
{
  "path": "demo.svg",
  "width": 320,
  "height": 160,
  "nodes": [
    { "id": "start", "label": "开始", "x": 10, "y": 12, "width": 90, "height": 40 },
    { "id": "end", "label": "结束", "x": 170, "y": 90, "width": 80, "height": 40 }
  ],
  "edges": [{ "id": "link", "from": "start", "to": "end" }]
}
```

将 `{"path":"demo.svg"}` 交给 `svg_inspect`，可看到 2 个 g、2 个 rect、2 个 text 和 1 条 line。读入范围沿用编辑器的六种 Phase 1 图形，缺少 ID 的图形会在结果中给出警告。工具卸载命令为 `dsh plugin --profile svg-demo remove dsh-svg-editor`。

## 按课程要求复验

[实验第三部分](../phase_cli_2-研-1.md)要求结合智能体使用场景开发 DSH 插件，建议开源和发布市场。自动验收直接调度宿主工具，可重复验证参数和错误路径。下方的桌面验收记录了真实模型按用户指令调用工具的结果。

| 检查              | 验证方式与结果                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DSH-01 加载与调用 | CLI 在新的 sdk-minimal profile 中安装 npm tarball。通过宿主原生工具注册表执行布局、生成和读回，验证四节点菱形图。                   |
| 业务契约与失败    | 测试替身和真实 codec 分别调用相同业务逻辑。在宿主中验证类型错、缺失端点、已有目标、读取失败，再成功读取缺 ID 样例并得到警告。       |
| PKG-02 安装与卸载 | 安装目录与源码工作区独立。在运行中的 Cordis 释放插件实例，三个工具注册消失。通过 dsh plugin remove 卸载，重新启动后再次检查注册表。 |
| CLI 兼容          | 原 CLI 继续渲染自己的文本。只抽出返回结构化结果的 openFile 和 saveFile，三组会话与 final 逐字节比较。                               |

从项目根执行单包和整仓检查：

```sh
npm test -w dsh-svg-editor
npm run check
npm run verify:visual
```

运行真实宿主验收时，可将固定版 DSH 和 pnpm 安装在项目外的独立目录。以 POSIX shell 为例：

```sh
runtime=$(mktemp -d)
npm install --prefix "$runtime" --ignore-scripts @deepseek-ai/dsh@0.2.2-rc.5 pnpm@10.32.1
export PATH="$runtime/node_modules/.bin:$PATH"
npm run demo:dsh
npm run verify:dsh
```

验收程序会新建临时 DSH_HOME、profile 和工作目录。要留存结果，在最后一条命令后追加 `-- --evidence <新目录>`。Ubuntu / Node 24 的 CI 也运行这项验证。[0.1.0 双工具验收记录](evidence/dsh/install/verification.json) · [生成的 SVG](evidence/dsh/install/flowchart.svg) · [卸载验证记录](records/2026-11-19-dsh.md)

## macOS 桌面版验收

2026-11-19 在 Apple Silicon Mac 上使用官方 DeepSeek Harness Desktop 0.2.2-rc.5、插件 `dsh-svg-editor@0.2.0` 和模型 DeepSeek-V4.1-Flash 完成。桌面应用使用自己的 `desktop` profile。[官方桌面版说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md#bundled-command-runtime)

1. 在仓库根目录按上文安装依赖并运行 `npm pack --workspace dsh-svg-editor --pack-destination .`。首次使用桌面版时先启动一次，再用 ⌘Q 退出。从同一目录执行以下命令，将验收包安装到桌面版。

   ```sh
   "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add "$PWD/dsh-svg-editor-0.2.0.tgz"
   ```

2. 重新打开桌面应用，确认插件已启用并选择可用模型。在可写的工作区打开会话。首次复验请选择尚无 `桌面验收.svg` 的目录，后续复跑也可以换新的工作区。
3. 输入下面的复验提示。完成后，在会话轨迹中依次展开三个工具。核对生成工具收到布局返回的画布、坐标和边，检查工具读取刚生成的同一路径。

   > 请用 svg_layout_flowchart 布局「开始 → 处理 → 完成」，将布局传给 svg_create_flowchart 新建「桌面验收.svg」。最后用 svg_inspect 从工作区读回这个文件，报告节点数、连线数和导入警告。

| 桌面会话中的实际调用   | 本次观测结果                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `svg_layout_flowchart` | 返回 448 × 96 画布。三个节点从左到右排列，标签依次为「开始」「处理」「完成」。                                            |
| `svg_create_flowchart` | 在工作区新建 `桌面验收.svg`。磁盘文件含 `start-process` 和 `process-done` 两条连接线。                                    |
| `svg_inspect`          | 读回同一文件，得到 3 个 `g`、3 个 `rect`、3 个 `text`、2 条 `line`，导入警告为 `[]`。每个节点组内各有一个矩形和一个标签。 |

验收结论为 **3 个节点、2 条连线、0 条导入警告**。可下载本次桌面生成的原文件，对照从会话记录提取的三次工具入参和读回结果。[桌面验收.svg](evidence/dsh/desktop/桌面验收.svg) · [工具调用与读回结果](evidence/dsh/desktop/verification.json)

## 社区市场发布清单

以课程列举的 `dsh-market` 为投稿目标。DSH 官方桌面版支持按 profile 添加第三方索引。此社区市场的目录由 `awesome-dsh-plugin` 维护，也可作为索引源添加到官方「发现」页。[课程原文](../phase_cli_2-研-1.md) · [官方索引规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md) · [市场投稿入口](https://github.com/dsh-market/dsh-market#submit-your-plugin)

截至 2026-11-19，仓库公开、仍在维护，创建于 11 月 15 日，已满足目录要求的仓龄。子包已声明 `dsh.bundle.patch`，包含对应 patch、三个工具及桌面验收证据。兼容声明精确限定 DSH 0.2.2-rc.5。社区目录接受 `apps/` 子包，可沿用当前仓库。[包清单](../apps/dsh-plugin/package.json) · [社区收录与评审规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

| 待办                       | 完成标志                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 让发布源码可从默认分支访问 | 当前 `main` 尚无插件。按依赖顺序评审并合入 #25、#26、#27，确认 `main/apps/dsh-plugin` 可浏览。团队按开源目标确认自有代码的许可证，打包时保留已有的 `xmldom-LICENSE`。                                                                                                                                                                                                             |
| 补全仓库与分发入口         | 仓库尚无 `dsh-plugin` topic、公开 Release 或同名 npm 包。添加目录要求的 topic。建议从选定发布提交打包，把预构建的 `.tgz` 附到固定标签的 GitHub Release，在干净 profile 从公开产物验证安装、三工具和卸载。子包构建引用仓库内的运行时，市场用户可以直接安装编译好的产物。                                                                                                           |
| 提交一条社区目录记录       | 在 `awesome-dsh-plugin/awesome-dsh-plugin` 提 PR，仅新增 `data/plugins/zero0307__svg-editor-platform--apps-dsh-plugin.yml`。填写指向本仓库 `tree/main/apps/dsh-plugin` 的 URL、名称 `zero0307/svg-editor-platform#dsh-svg-editor`、分类 `tools`、一句准确的英文功能描述，以及指向本次 Release 资产的 HTTPS `tarball` 链接。可附中文描述。核对相近条目，等待目录 CI 和维护者审核。 |
| 从市场完成最终复验         | 条目合并并同步后，在干净且版本匹配的 DSH profile 打开 `dsh-market`，搜索插件、确认安装来源、安装启用并重跑上面的三节点用例，再卸载。记录条目链接、发布版本及实测结果。                                                                                                                                                                                                            |

如团队选择发布到 npm，需要先调整**插件子包**当前的 `private: true`，补充指向本仓库及子目录的 `repository`，用发布账号验证包名和权限，再发布、验证具体版本。上表推荐的 GitHub Release 路径可直接利用现有打包流程。官方「发现」索引的版本来源仅支持 npm 或固定提交的 Git 子目录，社区条目的 Release `tarball` 字段属于 `dsh-market` 的安装机制。若也要支持原生「发现」安装，须另验索引中的实际 npm/Git 来源。#14/#16 跟踪团队的默认运行时迁移，后续替换运行时需要重跑验收。[官方版本来源格式](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md#index-format) · [社区分发选项](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

## Phase 边界与交接

已实现自动布局并接入三工具 demo。输入输出、独立认领范围及分支合并顺序见[DSH 开发方案](architecture/dsh-development.md)。

工具消费[公开会话接口](../packages/core/src/model.ts)。当前由[Phase 1 适配器](../src/bootstrap/Phase1EditorSession.ts)连接既有图形、编辑器和 XML codec，每次调用拥有独立文档。DSH 的[文件适配](../apps/dsh-plugin/src/DshFileStore.ts)使用宿主的路径解析、取消信号和写入策略。本次无需更改 Phase 1 的命令、输出或 final 标签。

生成和读回工具已使用这一适配器完成真实文件验证。等 #14 的默认插件运行时合入后，将打包入口中的会话实现切到新运行时，重跑同一套 `verify:dsh`，然后按既有依赖关闭 #16。其余 CLI 插件和 VSCode 板块按各自 Issue 继续开发。
