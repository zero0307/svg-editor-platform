# 课堂流程图的排版与真实模型对照

## 原画如何保留

针对「无插件版更好看」的反馈，0.11.0 直接在原图上增加点选。桌面预览将未经转换的 SVG 作为图像显示，并从独立 XML 树提取可命中的节点框。按原稿坐标放置透明按钮，只有主动选中才出现选中边框。标题修改通过节点 ID、文字序号和旧文字定位一个 XML 文本片段。在宿主新建文件后读回原件和结果校验字节。首次绘图可以让模型直接写带分组的 SVG，保留渐变、阴影、图标和自行设计的布局。

| 无插件组原始文件                                                         | 可点选节点 | 开启选区的像素差，1× 与 2× | 改一处文字后，目标框外的像素差 |
| ------------------------------------------------------------------------ | ---------: | -------------------------: | -----------------------------: |
| [并行审稿](../evidence/dsh/presentation/trials/review-without.svg)       |          7 |                       0、0 |                           0、0 |
| [双语数据检查](../evidence/dsh/presentation/trials/pipeline-without.svg) |          4 |                       0、0 |                           0、0 |
| [交叉注意力](../evidence/dsh/presentation/trials/ports-without.svg)      |          4 |                       0、0 |                           0、0 |

每张都是从无插件组复制的原文件，文件内容无需转换。尺寸相同的渲染器比较原图预览与带 15 个透明点击目标的预览；三个独立改字用例还验证被点中的框内实际发生像素变化。这项实验回答「能不能保留这张图的美观」，独立生成的质量另行观察。[审稿原图预览](../evidence/dsh/presentation/review-artwork.png) · [交叉注意力原图预览](../evidence/dsh/presentation/ports-artwork.png) · [像素审计脚本](../../apps/dsh-plugin/verification/artwork-audit.mjs)

在这台 Mac 的 DeepSeek Harness Desktop 中，打开「稿件发布-原稿.svg」后看到 7 个可选框。实际点击「事实核查」，选区将 `node-fact-check`、标题序号 1 和原文带入 Flash 对话。要求另存为「稿件发布-点选复核.svg」后，界面报 6 秒，宿主记录了三次 `svg_artwork` 调用。逐字节比对确认只有该标题的「核查」变为「复核」，原 SVG、副标题「核查关键信息」及其余图面均保留。升级初期的桌面进程仍提供旧的五个工具，先前的会话也曾误报工具缺失；完整退出、重启并在新会话检查工具后通过。[桌面产物](../evidence/dsh/presentation/desktop-edited.svg) · [磁盘摘要与实际工具用量](../evidence/dsh/presentation/desktop.json)

原稿里的交叉注意力公式省略了按键维度平方根缩放。0.11.1 支持定位卡片内部子分组里的公式。用插件将公式改为 `softmax(QKᵀ/√d)V`，并将下方一行说明改成「d 为每个注意力头的键维度」。逐字节对照确认两处文字以外均与无插件原件一致。1×、2× 编排检查及预览核对了公式框。这个修正来自人工对照论文。[论文第 3.2.1 节公式 (1)](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1) · [校正版 SVG](../evidence/dsh/presentation/cross-attention-scaled.svg) · [校正版预览](../evidence/dsh/presentation/cross-attention-scaled.png)

## 用同一份输入复验

模型在真实 Harness 会话里要求从左向右画交叉注意力。输入已经把解码器 Q、编码器 K/V 和上下文的来源写对了。早期实现将两路箭头挤在目标左边，K 标签碰到 Q 的线。工具两次拒绝落盘，第三次收到不完整坐标，第四次模型改为纵向才交付。现将那一轮第一次给工具的参数直接交给新版，同一次生成即得到横向图。新的入口根据上游位置给每个来源分配连续的端口，短直线优先，共用的 K/V 主干和两个箭头可以独立核验。[原始参数](../../apps/dsh-plugin/demo/cross-attention-auto.json) · [横向 SVG](../evidence/dsh/presentation/cross-attention.svg)

并行审稿图使用该模型另一次真实调用的节点、顺序和方向。插件将事实核查与事实确认放在同一列，文字审校与校样确认放在另一列。长短标签混排仍按各栏中心对齐。投影模式生成 16∶9 的画面，狭长纵向流程可与标题并排。内容较长或需要贴合边界时可以指定 `format: "content"`。[模型输入](../../apps/dsh-plugin/demo/editorial-auto.json) · [审稿图](../evidence/dsh/presentation/editorial.svg)

Transformer 总图由作者按参考图指定双塔坐标，插件绘制并读回 21 个节点、25 条逻辑连接、5 条残差旁路和 9 个具名注意力输入。原生宿主生成的 SVG 与仓库样张 SHA-256 相同。该图用于检查技术图的精确还原，自由生成的模型样本见下节。[可编辑 SVG](../evidence/dsh/presentation/Transformer.svg) · [大图预览](../evidence/dsh/presentation/Transformer.png) · [输入](../../apps/dsh-plugin/demo/transformer-presentation.json)

## 同模型绘图实验

使用官方 DeepSeek Harness 0.2.2-rc.5 headless 会话和同一账户的 `deepseek-account/deepseek-flash`，每题新建空目录和独立会话；每组都可以通过宿主的通用工具写 SVG 和检查图像。通过请求日志核对无插件组开放 0 个 SVG 工具，0.10 测试包开放 5 个，0.11 正式测试包开放 6 个。自由组收到完全相同的中文任务和「自行选最合适的可用绘图工具」指令。另做两次明确指定自动排版的诊断测试，结果单列。模型可在生成后自行调用通用工具修改文件。

每题每个条件只有一次。秒数为启动 DSH 进程至退出的实际经过时间，token 为宿主记录的各模型步骤总和，含缓存读取，不能直接换算账单成本。原生图形读回检查业务节点、实际连线、未确认连接与警告；通用 SVG 单独核对可见内容。审美判断依据同尺寸渲染比较，未进行盲评投票。

| 原始相同提示 | 无插件 / 0.10 秒 | 无插件 / 0.10 总 token（含缓存） | 两组工具调用数 |
| ------------ | ---------------: | -------------------------------: | -------------: |
| 并行审稿     |  236.55 / 221.42 |            1,056,032 / 1,359,073 |        36 / 42 |
| 双语数据流程 |  127.22 / 106.35 |                335,585 / 399,901 |        14 / 20 |
| 交叉注意力   |  276.89 / 233.54 |            1,190,376 / 2,213,379 |        30 / 54 |

三题使用 0.10 自动排版候选包（共享分叉及 16∶9 版式已启用）；桌面发布包在此基础上把能直接连接的短折线拉直，0.11 再加入原稿点选。三次都能交付，安装组在这三次分别更快、总 token 更高。双语题最终没有调用生成工具。无插件的审稿图用图标和颜色区分两条支线，交叉注意力用颜色区分 Q/K/V；我更喜欢这两张在投影时的辨识度。结构化图的长处是几何与来源可核验，独立生成的审美尚未证明全面胜出。[同尺寸对比](../evidence/dsh/presentation/comparison.png) · [原始提示、调用、总量和输出摘要](../evidence/dsh/presentation/trials.json)

早期探索版自由组的审稿题在 28.63 秒遇到模型工具 JSON 错误，没有文件；明确点名生成工具补测后 28.50 秒交付。交叉注意力的定向补测用了 57.01 秒、四次生成；同一份第一次调用后来成为横向分叉回归样例。双语题早期自由组用 133.04 秒，高于无插件的 127.22 秒。上述探索与补测试次保留在原始记录中。

0.11.0 另外用完全相同的审稿题从空白复测。模型调用过一次结构化生成，随后自行修改设计，最终的 SVG 有 7 个可点选节点，两个分支清楚对齐。耗时 177.20 秒，总 token 为 949,105；该次无插件对照为 236.55 秒和 1,056,032 token。模型没有调用 `svg_artwork`，可点选性由我们在产物上另行检查。这只是一个配对样本。[独立生成的 SVG](../evidence/dsh/presentation/trials/review-artwork.svg) · [预览](../evidence/dsh/presentation/review-generated.png)

另给交叉注意力题追加「自由设计原生 SVG 的配色、图标和层级，每张业务卡片用带独立 ID 的分组，完成后用 svg_artwork inspect」。0.11.0 的 Flash 从空目录自行画出了带图标、注意力矩阵和上下文向量的四卡片版本，实际使用 `svg_artwork` 读回，未调用结构化生成。可选卡片分别是解码器状态、编码器记忆、交叉注意力和上下文表示。用时 212.28 秒，总 token 1,040,847。该次提示经过引导，不能和自由组直接计算节省率。预览用覆盖中英文字和上下标的字体导出，原始 SVG 完整保留。自由设计模式未对通用 SVG 的每条路径作拓扑认证。[模型实际交付的 SVG](../evidence/dsh/presentation/trials/ports-artwork-design.svg) · [预览](../evidence/dsh/presentation/ports-generated.png)

## 自动验收与复跑

`npm run check` 覆盖原有课程基线、前端选区和 SVG 插件。并行路径回归在 36 种有固定种子的图形中打乱节点声明，覆盖横向、纵向、2 至 5 条路径与 2 至 4 层。另检验层间标签行数不等的情况，以及多来源 Q/K/V 在两种方向、正反节点顺序下的生成和读回。

`npm run verify:visual` 从序列化 SVG 重新测量箭头、端点、节点边界、路径交叉与重合。在 1× 和 2× 下检查 Transformer 的 17 个标题、说明和端口标签，交叉注意力的 4 个标题与端口标签，以及审稿图标题。`npm run demo:dsh` 在独立官方宿主打包、安装、生成、从磁盘读回并卸载。

```sh
npm run demo:dsh -- --input apps/dsh-plugin/demo/cross-attention-auto.json --theme presentation
npm run demo:dsh -- --input apps/dsh-plugin/demo/transformer-presentation.json --theme presentation
```
