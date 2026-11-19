# DeepSeek Harness SVG 插件

在 DSH 会话中，`svg_create_flowchart` 根据节点坐标、标签和连线生成可编辑 SVG，`svg_inspect` 读回画布、按文档顺序排列的结构、类型统计和导入警告。工具使用该会话的工作目录和 DSH 文件服务。生成目标须为新 `.svg` 文件，同名文件由宿主原子保护。

## 安装与使用

验证版本为官方 `@deepseek-ai/dsh@0.2.2-rc.5`、Node 24 和 pnpm 10。插件包带有 Phase 1 编辑运行时和 XML 编解码，DSH 提供工具注册表与文件服务。以下命令在项目根运行，要求 `dsh` 和 `pnpm` 在 PATH 中。使用独立的 `svg-demo` profile。[官方 bundle 安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)

```sh
npm ci
npm pack --workspace dsh-svg-editor --pack-destination .
dsh --profile svg-demo --from-default-profile sdk-minimal --dump-config
dsh plugin --profile svg-demo add ./dsh-svg-editor-0.1.0.tgz
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

[实验第三部分](../phase_cli_2-研-1.md)要求结合智能体使用场景开发 DSH 插件，建议开源和发布市场。这里以直接调度真实工具来验收，能重复验证同一组参数和错误路径，无需模型账号。模型自主选用工具和市场上架不计入本次证据。

| 检查              | 验证方式与结果                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| DSH-01 加载与调用 | CLI 在新的 sdk-minimal profile 中安装 npm tarball。通过宿主原生工具注册表执行两个工具，生成并读回中文 SVG。                     |
| 业务契约与失败    | 测试替身和真实 codec 分别调用相同业务逻辑。在宿主中验证类型错、缺失端点、已有目标、读取失败，再成功读取缺 ID 样例并得到警告。   |
| PKG-02 安装与卸载 | 安装目录与源码工作区独立。在运行中的 Cordis 释放插件实例，两个注册消失。通过 dsh plugin remove 卸载，重新启动后再次检查注册表。 |
| CLI 兼容          | 原 CLI 继续渲染自己的文本。只抽出返回结构化结果的 openFile 和 saveFile，三组会话与 final 逐字节比较。                           |

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
PATH="$runtime/node_modules/.bin:$PATH" DSH_CLI="$runtime/node_modules/@deepseek-ai/dsh/lib/bin.js" npm run verify:dsh
```

验收程序会新建临时 DSH_HOME、profile 和工作目录。要留存结果，在最后一条命令后追加 `-- --evidence <新目录>`。Ubuntu / Node 24 的 CI 也运行这项验证。[真实调度结果](evidence/dsh/install/verification.json) · [生成的 SVG](evidence/dsh/install/flowchart.svg) · [卸载验证记录](records/2026-11-19-dsh.md)

## Phase 边界与交接

本组下一项推荐开发自动布局。输入输出、独立认领范围及分支合并顺序见[DSH 开发方案](architecture/dsh-development.md)。

工具消费[公开会话接口](../packages/core/src/model.ts)。当前由[Phase 1 适配器](../src/bootstrap/Phase1EditorSession.ts)连接既有图形、编辑器和 XML codec，每次调用拥有独立文档。DSH 的[文件适配](../apps/dsh-plugin/src/DshFileStore.ts)使用宿主的路径解析、取消信号和写入策略。本次无需更改 Phase 1 的命令、输出或 final 标签。

两个工具已使用这一适配器完成真实文件验证。等 #14 的默认插件运行时合入后，将打包入口中的会话实现切到新运行时，重跑同一套 `verify:dsh`，然后按既有依赖关闭 #16。其余 CLI 插件和 VSCode 板块按各自 Issue 继续开发。
