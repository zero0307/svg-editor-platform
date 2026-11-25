# DSH SVG 流程图插件

在 DeepSeek Harness 里把节点和关系排成流程图，保存为可编辑 SVG，再读回文件检查内容。0.9.2 适配 DSH 0.2.2-rc.5。示例使用 Node 24、pnpm 10。

## 在已有 DSH 中试用

将验收包下载到当前目录，指定自己实际使用的 profile，以下以 web 为例。

```sh
dsh plugin --profile web add ./dsh-svg-editor-0.9.2.tgz
```

打开该 profile 的 DSH 会话，给智能体这段指令（模型会话需要配置可用模型）：

> 画一个审批流程。提交后并行评审和复核，两项都完成后通过。先用 svg_layout_flowchart 布局，再用 svg_create_flowchart 保存成 review.svg，最后用 svg_inspect 核对节点、文字和连线。把文件路径和检查结果告诉我。

第一次请选择新文件名。预期 `graph.nodes` 和 `graph.edges` 各有 4 项。再次生成到已有文件时会提示失败，已有内容会保留。卸载命令为 `dsh plugin --profile web remove dsh-svg-editor`。

| 工具                   | 输入                                                 | 返回                                                            |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| `svg_layout_flowchart` | `nodes[{id,label}]` 和有方向的 `edges[{id,from,to}]` | 画布大小、节点坐标和原连线，可直接交给生成工具                  |
| `svg_create_flowchart` | 布局结果加 `path`，可选 `theme`，也可手工指定坐标    | 新建 SVG 的路径、节点数和边数                                   |
| `svg_inspect`          | `path`                                               | 业务节点、有向边、未确认关系，以及原始 SVG 结构、统计和导入警告 |

自动布局支持分叉、汇合、孤立节点和多个互不相连的子图。有环图可以手工指定坐标，连接线要求两个不同端点。检查工具支持课程编辑器的 SVG 子集。

## 在桌面预览中点选节点

在会话右侧打开「工作区文件」，选择插件生成的 SVG。预览顶部显示「点选节点，将它引用到当前对话」。点击图里的目标框，或用 Tab 移到目标后按 Enter。输入框会出现一张可移除的「SVG 选区」卡片，里面有文件路径、节点 ID 和简短的当前标签。同名框也有各自的 ID。

例如，在含五个 Add & Norm 的 Transformer 图上点一个框，发送「只把这个框第一行改成课堂重点，保留副标题和其他内容，另存 result.svg 并读回」。发送前可以移除旧卡片重选。普通 SVG 仍可用图片或源码方式查看。

单行修改使用 `svg_edit_flowchart` 的 `rename`、`nodeId`、`labelLine` 和 `label`。`labelLine` 从框内第一行数起。成功时工具返回从磁盘核对过的完整标签、`otherBytesUnchanged` 及包含原件核对状态与输出 SHA-256 的 `diskReadBack`。如果新文字放不下或目标行已自动折行，工具会提示需要重排。只想核对一个框时，用 `svg_inspect(path, nodeId)` 可读回该节点和全图计数。需要局部前后对照图时可传 `previewPath`。

同一台 Mac 上比较五次点选和五次无插件位置描述，结果与一次较慢的反例见[桌面点选验收](../../doc/records/2026-11-25-dsh-desktop-selection.md)。

## 在原图上修改并核验

打开一个含插件原生 SVG 的工作区，直接告诉 DeepSeek 希望保留的内容和要修改的部分。例如“将编码器输出到交叉注意力的 K 和 V 合成一条共用主干。保留 Q 和其他模块，另存 result.svg 并读回核对”。也可以说“在评审到发布之间插入安全检查，保留驳回分支”。

- `svg_inspect` 会在检查结果开头给出当前图中可合并的同源端口。每一项都列出编辑工具、来源 ID、目标 ID 和端口名，模型可以直接复用。
- `svg_edit_flowchart` 接受原件 `path` 和新文件 `output`。支持 `merge_inputs`、`insert`、`rename` 和 `reconnect`。端点可用稳定 ID 或唯一标签。插入节点可提供空闲位置。共用主干可从已有具名边或仅承担转接的一进一出端口小框生成。它在写盘前校验候选图和未修改的元素，写盘后核对磁盘内容，整节点和连线编辑还会生成局部前后对照 SVG。若预览文件已存在，返回单独的预览错误及已保存的主文件路径。
- `svg_check_flowchart` 从磁盘核对预期的节点 ID、完整标签数量、有向边和同源具名端口。举例，交叉注意力仅当来自编码器的一条合格连接同时携带 `["K","V"]` 才满足共用主干要求。缺翼箭头会返回对应端口和坐标，传入新文件名 `markPath` 可以生成带红圈的故障副本。
- 编辑器面向带原生节点和连线信息的 SVG。遇到通用 SVG 或带变换的图形，几何核验可以返回 `unverified`。模型另行改写文件后，应重新调用检查工具。比较图是展示用文件。

使用同一张原图的模型对照、端口故障复验及示例文件见[局部改图实测](../../doc/records/2026-11-24-dsh-local-edits.md)。

## 生成汇报图或打印稿

默认的 `studio` 按连线关系给节点分配外观。深蓝表示起点，琥珀色表示分叉，浅青表示汇合，深绿表示终点。一个起点直接分叉时优先使用起点样式。长标签自动换行，每一行都是可编辑的 SVG 文字。读回完整标签用 `graph.nodes[].label`，统计业务连线用 `graph.edges.length`。

> 画一张发布流程图。提交申请后评估风险，同时做回归测试和隐私审查，汇总后发布。在同一个布局上用 svg_create_flowchart 分别生成「发布汇报.svg」和「发布打印.svg」。第一份用 studio，第二份用 print，再读回核对两份的节点与连线。

`print` 使用灰阶填充、深色描边与相同的箭头，适合黑白讲义。下面是同一份输入实际生成的两张图。[彩色示例](../../doc/evidence/dsh/design/studio.svg) · [打印示例](../../doc/evidence/dsh/design/print.svg)

## 按参考图决定线型

将参考图与任务一起交给 DSH 模型。例如“按这张图的方向和分区画，模块以中文为主，保留 Add & Norm 和 Softmax。主干保持直线，必要时绕行，最后读回核对每条残差与交叉注意力。”

生成工具可选 `connectorStyle`。默认 `angular` 支持直线和避障折线，`rounded` 将已有折线的转角圆滑化，`arc` 尝试二次贝塞尔弧线。用 `edgeStyles` 按业务边 ID 局部覆盖，主流程可以沿用默认。空间受限时回退到经验证的安全路线。插件自 0.6.0 起支持读回生成的 SVG 原生二次曲线。需要交给 Phase 1 CLI 时将图和边的线型均设为 `angular`。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer-reference.json
npm run demo:dsh -- --input apps/dsh-plugin/demo/release-curves.json
```

[参考图版 Transformer](../../doc/evidence/dsh/captions/Transformer.svg) · [自动布局的发布流程](../../doc/evidence/dsh/curves/release.svg) · [标题避让验收](../../doc/dsh.md#标题避让与本地性能) · [性能对照](../../doc/dsh.md#线型与读回性能)

## 绘制 Q、K、V 分叉箭头

在一条边上指定有序的 `inputs`。例如 `{"id":"self-in","from":"embedding","to":"attention","inputs":["Q","K","V"]}` 会从一个来源绘制一根主线，在目标矩形前分出三支具名箭头。交叉注意力需要两条边，解码器边指定 `["Q"]`，编码器边指定 `["K","V"]`。同一目标的每个端口名称应唯一。重新打开文件后，查看 `graph.edges[].inputs` 可核对每个输入的名称与来源。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer-qkv.json
```

这张图保持 21 个节点、25 条逻辑连接，最终有 30 个可见箭头，其中 9 个标注了注意力输入。[可编辑架构图](../../doc/evidence/dsh/qkv/Transformer.svg) · [输入与验证](../../doc/dsh.md#qkv-分叉箭头)

## 用 Transformer 架构图验收

在源码仓库运行以下命令。打开输出目录的 `demo.svg`，沿左栏可看到编码器生成记忆表示，沿右栏可看到移位的目标输入、掩码自注意力和交叉注意力。图中折叠显示每侧六层；五条旁路对应五个子层的残差连接。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer.json
```

向 `svg_create_flowchart` 传入明确的坐标、可选 `title` 和 `panels` 可以保留双栏排版。面板接受标题、可选说明和矩形范围。请在面板顶部为标题和说明留白。0.6.1 会根据实际连线、箭头和节点位置选择可用位置；标题和说明一起移动。空间不足时，工具会指出需要扩大的面板。读回业务关系用 `graph`，背景板与标题只进入 SVG 元素统计。本例有 18 个节点、22 条有向边。[可编辑架构图](../../doc/evidence/dsh/transformer/Transformer.svg) · [多层压力测试与数据](../../doc/dsh.md#transformer-架构图与性能验证)

## 检查直达路线与箭头

> 画出提交 → 审核 → 通过，并添加一条提交直接到通过的免审路线。将三条边依次命名为 e1、e2、e3，保存为 shortcut.svg。读回文件，告诉我 e3 从哪里出发、到哪里结束。

箭头指向目标矩形边界，直达路线遇到其他节点会尝试折线绕行。每条业务边在 SVG 中有自己的分组。读回时用 `graph.edges` 对照输入的 ID、from 和 to；`counts.line` 统计所有实际线段，包含折线和箭头。旧图根据独特的矩形中心匹配得到的边会列入 `graph.inferredEdges`，无法确认的边 ID 列入 `graph.unresolvedEdges`。手动排版过于拥挤导致无可用路线时，可以增加节点间距和画布边距。示例输入位于源码仓库的 `apps/dsh-plugin/demo/shortcut.json`。

## 在 Mac 桌面版验收

在 Desktop 0.2.2-rc.5 的 `desktop` profile 中启用本插件，在可写的新工作区选择模型，发送下面的指令。

> 请用 svg_layout_flowchart 布局「开始 → 处理 → 完成」，用 svg_create_flowchart 将布局保存为「桌面验收.svg」，再用 svg_inspect 读回该文件，报告节点数、连线数和导入警告。

2026-11-19 使用 0.2.0 的桌面会话实际生成了 448 × 96 的 SVG。读回和磁盘文件均有 **3 个节点、2 条连线**，工具返回的导入警告为 `[]`。[桌面安装、复验步骤与原始 SVG](../../doc/dsh.md#macos-桌面版验收) · [市场发布进度](../../doc/dsh.md#社区市场发布清单)

## 在源码仓库复跑 demo

从仓库根执行。先安装项目依赖，并将上述版本的 DSH 及 pnpm 加入 PATH。隔离安装步骤见仓库内的 `doc/dsh.md`。

```sh
npm ci
npm run demo:dsh
```

程序会打包并安装到全新的临时 profile，在真实 Agent 会话目录执行三个工具，再检查卸载。终端打印本次输出目录，打开 `demo.svg` 看图，`verification.json` 包含输入、布局和实际读回结果，同目录里的 .tgz 就是这一轮安装过的包。每次运行使用新的目录。这个可复现演示无需模型密钥。

要试自己的图，可复制 `apps/dsh-plugin/demo/review.json`，改节点和边，再运行 `npm run demo:dsh -- --input my-graph.json`。
