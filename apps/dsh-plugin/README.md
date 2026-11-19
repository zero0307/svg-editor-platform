# DSH SVG 流程图插件

在 DeepSeek Harness 里把节点和关系排成流程图，保存为可编辑 SVG，再读回文件检查内容。0.2.0 已适配 DSH 0.2.2-rc.5。示例使用 Node 24、pnpm 10。

## 在已有 DSH 中试用

将验收包下载到当前目录，指定自己实际使用的 profile，以下以 web 为例。

```sh
dsh plugin --profile web add ./dsh-svg-editor-0.2.0.tgz
```

打开该 profile 的 DSH 会话，给智能体这段指令（模型会话需要配置可用模型）：

> 画一个审批流程。提交后并行评审和复核，两项都完成后通过。先用 svg_layout_flowchart 布局，再用 svg_create_flowchart 保存成 review.svg，最后用 svg_inspect 核对节点、文字和连线。把文件路径和检查结果告诉我。

第一次请选择新文件名。预期有 4 个分组、4 个矩形、4 个文本和 4 条线。再次生成到已有文件时会提示失败，已有内容会保留。卸载命令为 `dsh plugin --profile web remove dsh-svg-editor`。

| 工具                   | 输入                                                 | 返回                                             |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `svg_layout_flowchart` | `nodes[{id,label}]` 和有方向的 `edges[{id,from,to}]` | 画布大小、节点坐标和原连线，可直接交给生成工具   |
| `svg_create_flowchart` | 布局结果加 `path`，或手工指定画布及坐标              | 新建 SVG 的路径、节点数和边数                    |
| `svg_inspect`          | `path`                                               | 画布大小、元素类型统计、父子结构、文字和导入警告 |

自动布局支持分叉、汇合、孤立节点和多个互不相连的子图。有环图可以手工指定坐标，连接线要求两个不同端点。检查工具支持课程编辑器的 SVG 子集。

## 在 Mac 桌面版验收

在 Desktop 0.2.2-rc.5 的 `desktop` profile 中启用本插件，在可写的新工作区选择模型，发送下面的指令。

> 请用 svg_layout_flowchart 布局「开始 → 处理 → 完成」，用 svg_create_flowchart 将布局保存为「桌面验收.svg」，再用 svg_inspect 读回该文件，报告节点数、连线数和导入警告。

2026-11-19 的桌面会话实际生成了 448 × 96 的 SVG。读回和磁盘文件均有 **3 个节点、2 条连线**，工具返回的导入警告为 `[]`。[桌面安装、复验步骤与原始 SVG](../../doc/dsh.md#macos-桌面版验收) · [市场发布进度](../../doc/dsh.md#社区市场发布清单)

## 在源码仓库复跑 demo

从仓库根执行。先安装项目依赖，并将上述版本的 DSH 及 pnpm 加入 PATH。隔离安装步骤见仓库内的 `doc/dsh.md`。

```sh
npm ci
npm run demo:dsh
```

程序会打包并安装到全新的临时 profile，在真实 Agent 会话目录执行三个工具，再检查卸载。终端打印本次输出目录，打开 `demo.svg` 看图，`verification.json` 包含输入、布局和实际读回结果，同目录里的 .tgz 就是这一轮安装过的包。每次运行使用新的目录。这个可复现演示无需模型密钥。

要试自己的图，可复制 `apps/dsh-plugin/demo/review.json`，改节点和边，再运行 `npm run demo:dsh -- --input my-graph.json`。
