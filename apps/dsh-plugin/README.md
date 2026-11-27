# DeepSeek Harness SVG 插件

在 Harness 会话里生成可编辑的流程图，或打开已有 SVG，点选具体的节点和连线进行修改。插件版本为 0.14.2，适配 DeepSeek Harness 0.2.2-rc.5。

## 安装到桌面版

从源码使用时，在仓库根目录依次运行 `npm ci`、`npm run build` 和 `npm pack --workspace dsh-svg-editor`。版本发布后也可以从 Releases 下载安装包。进入安装包所在目录，安装到桌面版使用的 profile，然后重新打开该 profile 的会话。[发行版本](https://github.com/zero0307/svg-editor-platform/releases)

```sh
dsh plugin --profile desktop add ./dsh-svg-editor-0.14.2.tgz
```

Web 版将 `desktop` 换为 `web`。要卸载桌面插件，执行 `dsh plugin --profile desktop remove dsh-svg-editor`。

## 画一张流程图

> 画一个审批流程。提交后分为评审和复核，两者都连到通过。用 svg_create_flowchart 横向排版，保存为 review.svg，再用 svg_inspect 读回，告诉我各条边的起点和终点。

给每个节点和每条边分配唯一 ID。无环图可以只给节点和关系，让工具自动排版。有参考图、环路或固定分区时，提供画布尺寸和节点坐标。主题可选 `presentation`、`studio` 和 `print`。在边上设置 `inputs: ["K", "V"]` 可以表达同一来源分出的两条具名输入。检查逻辑连线数用 `graph.edges.length`；一个带分叉的箭头可能由多段 SVG 图形组成。

## 点选并修改

1. 在会话右侧的工作区文件中打开 SVG。点击模块后，输入框会出现选区卡片。再次点击其他模块会替换当前目标，已输入的文字会保留。也可以用 Tab 和 Enter 选择。
2. 修改文字时，点中目标后告诉模型「把这个框的第一行改为『终审』，另存为 final-review.svg」。同名模块通过选区的 ID 区分。
3. 修改连线时，先点线，选择「改起点」或「改终点」，再点目标模块。重叠线可从候选列表中选择。线型可选直线、弧线、折线或圆角折线。若路线会穿过节点，预览会给出原因。
4. 满意后点「另存 SVG」。桌面可直接保存预览中的改动，也可把选区带入当前对话继续编辑。Esc 可以取消正在进行的端点选择。

自由绘制的 SVG 可以保留原有渐变、图标和排版。建议给每个业务模块使用带唯一 ID 的 `<g>`，分组中保留矩形、圆形或椭圆形边框和可编辑文字。自由图的自动重连要求路径端点可识别，且箭头通过 `marker-end` 附在线身上。对于已转曲的文字，先将其恢复为 SVG 文本再改名。

## 会话工具

| 工具                   | 用途                                                           |
| ---------------------- | -------------------------------------------------------------- |
| `svg_layout_flowchart` | 为有向图计算画布和节点坐标。                                   |
| `svg_create_flowchart` | 自动或按显式坐标，新建一个 SVG 文件。                          |
| `svg_inspect`          | 读回节点、已确认或待确认的连线、原始元素及导入警告。           |
| `svg_edit_flowchart`   | 修改原生图的标签、插入节点、改接端点或合并同源输入，另存副本。 |
| `svg_artwork`          | 定位自由 SVG 的节点和连线，修改选定文字或连接。                |
| `svg_check_flowchart`  | 对照预期节点、连接和端口检查已保存的原生图。                   |

生成和编辑时请使用新文件名。要核对一次修改，可以请模型读回副本，按具体的节点 ID 或有向边 ID 检查。

本插件及随包分发的自有代码采用 MIT 许可证。[MIT](LICENSE) · [xmldom 声明](xmldom-LICENSE) · [svgpath 声明](svgpath-LICENSE)
