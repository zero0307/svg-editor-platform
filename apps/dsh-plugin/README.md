# DSH SVG 流程图插件

在 DeepSeek Harness 里把节点和关系排成流程图，保存为可编辑 SVG，再读回文件检查内容。0.5.0 适配 DSH 0.2.2-rc.5。示例使用 Node 24、pnpm 10。

## 在已有 DSH 中试用

将验收包下载到当前目录，指定自己实际使用的 profile，以下以 web 为例。

```sh
dsh plugin --profile web add ./dsh-svg-editor-0.5.0.tgz
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

## 生成汇报图或打印稿

默认的 `studio` 按连线关系给节点分配外观。深蓝表示起点，琥珀色表示分叉，浅青表示汇合，深绿表示终点。一个起点直接分叉时优先使用起点样式。长标签自动换行，每一行都是可编辑的 SVG 文字。读回完整标签用 `graph.nodes[].label`，统计业务连线用 `graph.edges.length`。

> 画一张发布流程图。提交申请后评估风险，同时做回归测试和隐私审查，汇总后发布。在同一个布局上用 svg_create_flowchart 分别生成「发布汇报.svg」和「发布打印.svg」。第一份用 studio，第二份用 print，再读回核对两份的节点与连线。

`print` 使用灰阶填充、深色描边与相同的箭头，适合黑白讲义。下面是同一份输入实际生成的两张图。[彩色示例](../../doc/evidence/dsh/design/studio.svg) · [打印示例](../../doc/evidence/dsh/design/print.svg)

## 用 Transformer 架构图验收

在源码仓库运行以下命令。打开输出目录的 `demo.svg`，沿左栏可看到编码器生成记忆表示，沿右栏可看到移位的目标输入、掩码自注意力和交叉注意力。图中折叠显示每侧六层；五条旁路对应五个子层的残差连接。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer.json
```

向 `svg_create_flowchart` 传入明确的坐标、可选 `title` 和 `panels` 可以保留双栏排版。面板接受标题、可选说明和矩形范围。请在左上角为标题和说明留出空间。读回业务关系用 `graph`，背景板与标题只进入 SVG 元素统计。本例有 18 个节点、22 条有向边。[可编辑架构图](../../doc/evidence/dsh/transformer/Transformer.svg) · [多层压力测试与数据](../../doc/dsh.md#transformer-架构图与性能验证)

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
