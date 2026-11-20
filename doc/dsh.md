# DeepSeek Harness SVG 插件

当前开发版为 0.6.0。在 DSH 会话中，`svg_layout_flowchart` 将节点与有向边排成流程图，`svg_create_flowchart` 根据节点坐标、标签和连线生成可编辑 SVG，`svg_inspect` 读回画布、按文档顺序排列的结构、类型统计和导入警告。工具使用该会话的工作目录和 DSH 文件服务。生成目标须为新 `.svg` 文件，同名文件由宿主原子保护。

## 先跑四节点 demo

具备 Node 24、仓库依赖和下文所列的 DSH、pnpm 后，在仓库根运行：

```sh
npm run demo:dsh
```

运行时真实创建 Agent，工作目录与宿主启动目录独立。它根据[输入文件](../apps/dsh-plugin/demo/review.json)依次调用布局、生成和检查工具。打开终端输出目录中的 `demo.svg`，从左到右应是「提交 → 评审／复核 → 通过」。在同目录的 `verification.json` 查看 `demo.inspected`，当前版本的 `graph` 应有 4 个节点和 4 条边。修改输入后可运行 `npm run demo:dsh -- --input my-graph.json`。安装到自己的会话试用时，使用同目录中的 .tgz 和[插件使用说明](../apps/dsh-plugin/README.md)。

0.2.0 留存了[实际生成的 SVG](evidence/dsh/demo/demo.svg) 和[三工具验收结果](evidence/dsh/demo/verification.json)。

## 线型与读回性能

0.6.0 的参考图保留原论文图 1 的自下向上数据流、左右堆栈、位置编码加法与五条残差旁路。两侧各用一个图层代表六层重复结构。解码器的交叉注意力接收来自上一子层的查询、编码器最终输出投影得到的键和值。中文标签保留关键英文术语。生成时允许模型选择直线、圆角折线或局部弧线。该参考图只在绕行的折角使用二次曲线。[论文图 1](https://arxiv.org/html/1706.03762v7#S3) · [输入](../apps/dsh-plugin/demo/transformer-reference.json) · [可编辑 SVG](evidence/dsh/curves/Transformer.svg)

性能基准沿用同一份自动展开输入。在 1、6、12、24 层分别预热一次、测量五次，比较 0.5.0 默认折线与 0.6.0 三种样式。记录布局、序列化生成、解析读回、文件字节数、原生曲线数及拓扑摘要。计时使用 Apple M5、Node 24 和内存文件服务。真实 DSH 另行安装验收包，生成、读回参考图、普通流程图及 24 层压力图。[全部性能数据](evidence/dsh/curves/performance.json) · [真实宿主摘要](evidence/dsh/curves/host.json)

24 层展开图共有 271 个节点、413 条边。下表是分阶段中位数，生成包含序列化，读回包含解析与关系校验。四组的业务图摘要完全一致。

| 版本及线型     | 布局 (ms) | 生成 (ms) | 读回 (ms) | SVG 字节 |
| -------------- | --------: | --------: | --------: | -------: |
| 0.5.0 折线     |      1.80 |     44.99 |     65.00 |   390143 |
| 0.6.0 折线     |      1.93 |     45.35 |     22.59 |   390143 |
| 0.6.0 圆角     |      1.75 |     50.11 |     27.70 |   444273 |
| 0.6.0 弧线优先 |      1.82 |     51.30 |     26.44 |   461488 |

这组测量支持按图选择线型。相同折线文件的读回节省约 65%，将所有边设为弧线优先会使生成耗时比新版折线增加约 13%，文件增加约 18%。不同机器、字体和宿主调用开销会影响用户实际看到的等待时间。

```sh
npm run build
node apps/dsh-plugin/verification/transformer-bench.mjs --style angular
node apps/dsh-plugin/verification/transformer-bench.mjs --style rounded
node apps/dsh-plugin/verification/transformer-bench.mjs --style arc
```

新版导入沿用 XML 编解码器的全局 ID 预检、自动分配和最终树校验，省去每插入一个已校验图元时的全树扫描。读回带方向的边时同步检查端点、连续性和箭头的实际方向。端点偏移、箭头缺翼或曲线切线被反转的边会列入 `graph.unresolvedEdges`。[回归用例](../apps/dsh-plugin/test/curves.test.ts) · [接口约定](adr/0006-dsh-quadratic.md)

运行 `npm run verify:visual` 还会独立解析已导出的两份 SVG，并对当前实现重新生成的两份 SVG 执行同样的检查。按输入逐边核对方向、矩形或椭圆边界上的端点、连续性和箭头两翼。参考图的 25 条连接、发布流程的 6 条连接均通过，未检出穿过无关节点、越出画布、意外交叉或线段重叠。二次曲线细分至控制点相对弦中点偏差不超过 0.02 个画布单位，沿线以不超过 0.5 单位的间距检查节点边界。这个交叉检查用于两张有明确版式的验收图；稠密压力图另以拓扑一致性验收。[独立几何验收](../apps/dsh-plugin/verification/connector-audit.mjs)

## Transformer 架构图与性能验证

概览采用原论文的编码器–解码器结构，左右各画一个代表层，以 ×6 表示重复。每个子层的旁路连接输入与 Add & Norm，编码器最后一层的输出为每个解码器交叉注意力层提供 K/V，查询来自解码器。生成时采用示例指定的双栏坐标。展开测试使用插件的通用自动布局。[原论文第 3 节及图 1](https://arxiv.org/html/1706.03762v7#S3) · [双栏输入](../apps/dsh-plugin/demo/transformer.json) · [实际 SVG](evidence/dsh/transformer/Transformer.svg)

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer.json
node apps/dsh-plugin/verification/transformer-bench.mjs
node apps/dsh-plugin/verification/transformer-bench.mjs --export-layers 24 > artifacts/transformer-24.json
npm run demo:dsh -- --input artifacts/transformer-24.json
```

基准在同一台机器逐个运行旧版和新版。每个深度预热一次并计时五次，分别记录布局、含 SVG 序列化的生成、含 XML 解析的读回中位数。使用真实的插件实现与内存文件服务，每次逐项比对节点、标签、方向与顺序。重测旧包时将 tarball 解开，再向基准传 `--package-dir <解压出的 package 目录>`。[分阶段耗时与图摘要](evidence/dsh/transformer/performance.json)

CPU 采样显示旧版反复遍历图形树查找 ID，绕线器为单条边重新枚举整图通道。新版维护会话内的图形索引，按图复用通道坐标，并用路径长度下界跳过无法胜出的绕行。多个等长方案可用时优先选择空闲端点，使相邻残差连接更易区分。

真实 DSH 的概览与 24 层展开图分别读回 18 节点 / 22 边和 271 节点 / 413 边。两者的导入警告与未确认边均为空。原验收脚本在宿主退出时会截断大型标准输出，新版先写完独立 JSON 文件，再由父进程加载并解析。Ubuntu / Node 24 CI 复跑 24 层宿主验证。基准耗时仅覆盖插件的本地处理。[宿主验收摘要](evidence/dsh/transformer/host.json)

## 0.4.0 主题与复杂图验收

在仓库根执行以下命令。将 `studio` 换为 `print` 可输出同一版式的灰阶打印稿。程序会在同一隔离 DSH profile 中实际生成并检查两种主题，终端给出所选主题的 SVG、完整读回报告和安装包路径。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/release.json --theme studio
npm test -w dsh-svg-editor
npm run verify:visual
```

发布流程示例含 6 个节点、6 条有向边。隐私节点的长标签换成两行，同列的回归测试保持短框。生成后使用 `svg_inspect` 的 `graph` 对照输入，可核对完整标签、方向与顺序。两份 SVG 都应返回 0 条导入警告和 0 条未确认边。[输入](../apps/dsh-plugin/demo/release.json) · [汇报图](evidence/dsh/design/studio.svg) · [打印稿](evidence/dsh/design/print.svg) · [宿主读回摘要](evidence/dsh/design/result.json)

| 难例             | 检查方法与结果                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 稠密关系图       | 8 层、每层 8 个节点，相邻层全连接。真实 SVG 编解码逐项还原 64 个节点与 448 条有向边，无未确认边或导入警告。此例验证关系完整性，边与边仍可能交叉。                               |
| 四道交错障碍     | 正反向路线都经过全部开口，独立几何断言检查每段与障碍至少相距 4 个画布单位。完全封住通道时生成报错并保留原文件。                                                                 |
| 多语言与可编辑性 | 中文长句、组合重音、家庭 emoji、XML 特殊字符和不同换行符均能读回原文。编辑可见续行后，读回同步变化。                                                                            |
| 视觉回归         | 两套主题的五类节点均校验文字与底色对比度 ≥ 4.5∶1。在 1 倍和 2 倍渲染后，对比含字图和空白底图区分文字像素，验证中英混排、宽字母、emoji 和手工小节点的文字距框至少 2 个画布单位。 |
| 历史文件         | 隔离宿主读取 0.2.0 的桌面图和 0.3.0 的直达路线图，分别验证中心线推断和显式方向。                                                                                                |

[复杂图用例](../apps/dsh-plugin/test/design.test.ts) · [像素验收](../apps/dsh-plugin/verification/visual.mjs) · [绘制属性契约](adr/0005-session-presentation.md)

## 0.3.0 有向边验收

从下方的宿主环境运行 `npm run demo:dsh -- --input apps/dsh-plugin/demo/shortcut.json`。打开生成的 SVG，可看到「提交 → 审核 → 通过」和绕过「审核」的直达箭头。核对 `verification.json` 中的 `demo.inspected.graph`，边 e3 应为 `a → c`；独立宿主用例还保持布局不变、把 e3 反向，在另一文件中读回 `c → a`。[示例输入](../apps/dsh-plugin/demo/shortcut.json) · [实际 SVG](evidence/dsh/directed/shortcut.svg) · [0.3.0 宿主读回结果](evidence/dsh/directed/verification.json) · [真实宿主验收程序](../apps/dsh-plugin/verification/probe.mjs)

`graph.nodes` 和 `graph.edges` 返回业务节点、标签和方向。新文件带有端点标记，读回时还核对连接线与节点边界。旧版按中心绘制的边只在端点均匹配唯一旧节点时推断，ID 列入 `inferredEdges`。无法识别的线或失去有效端点的边列入 `unresolvedEdges`。`counts` 和 `structure` 仍反映全部 SVG 元素，箭头的两翼属于绘制线段。局部连线可能相交；手工布局无法找到路径时工具报错，并保留现有文件。[接口决策](adr/0004-session-shape-data.md)

## 安装与使用

验证版本为官方 `@deepseek-ai/dsh@0.2.2-rc.5`、Node 24 和 pnpm 10。插件包带有 Phase 1 编辑运行时和 XML 编解码，DSH 提供工具注册表与文件服务。以下命令在项目根运行，要求 `dsh` 和 `pnpm` 在 PATH 中。使用独立的 `svg-demo` profile。[官方 bundle 安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)

```sh
npm ci
npm pack --workspace dsh-svg-editor --pack-destination .
dsh --profile svg-demo --from-default-profile sdk-minimal --dump-config
dsh plugin --profile svg-demo add ./dsh-svg-editor-0.6.0.tgz
dsh --profile svg-demo --dump-config
```

使用已有的 web profile 时，将上面的 `svg-demo` 换成 `web`，安装后以 `dsh web` 启动会话。可以提问“生成一张开始与结束两节点的流程图并保存为 demo.svg，再读回检查文字”。也可按下面的参数调用工具。每个节点的坐标对应矩形左上角，连线从源节点边界出发，绕开遮挡的节点，并在目标边界画箭头。每条边的两端须为不同节点。

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

将 `{"path":"demo.svg"}` 交给 `svg_inspect`，应在 `graph` 中看到 2 个节点和 1 条从 start 到 end 的边。读入范围沿用编辑器的六种 Phase 1 图形，缺少 ID 的图形会在结果中给出警告。工具卸载命令为 `dsh plugin --profile svg-demo remove dsh-svg-editor`。

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

以下命令展示在当前分支安装 0.6.0 的方法。表中记录对应当时实测的 0.2.0。

1. 在仓库根目录按上文安装依赖并运行 `npm pack --workspace dsh-svg-editor --pack-destination .`。首次使用桌面版时先启动一次，再用 ⌘Q 退出。从同一目录执行以下命令，将验收包安装到桌面版。

   ```sh
   "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add "$PWD/dsh-svg-editor-0.6.0.tgz"
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
