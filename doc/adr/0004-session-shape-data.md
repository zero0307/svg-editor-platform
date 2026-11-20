# ADR-0004 创建图形时保留 SVG 数据属性

状态：Proposed，随本次接口变更评审。

流程图的边 ID 由调用方指定，可以是 `e3`。把起止节点记录到边组的 `data-dsh-from` 和 `data-dsh-to`，编辑器读回后就能验证方向。路由使用已有的分组与线段，箭头和折线能在课程 SVG 子集中编辑。

`EditorSessionPort.create` 接受含可选 `dataAttributes` 的 `SessionShapeRequest`。会话只接受小写 `data-*` 键和字符串值，通过既有 SVG 属性序列化与解析路径写入和恢复。Phase 1 会话和测试替身都实现这一约定。省略该字段的调用继续使用原行为。后续 #14 的会话实现也需通过同一套读回测试。[会话接口](../../packages/core/src/model.ts) · [插件用例](../../apps/dsh-plugin/test/tools.test.ts)

`svg_inspect` 保留元素级统计，并单独返回流程图节点、边及识别状态。0.2.0 的中心连线可以根据文件内几何关系推断；重叠节点、悬空线和无效引用在结果中列为未确认。插件无需相邻的元数据文件。
