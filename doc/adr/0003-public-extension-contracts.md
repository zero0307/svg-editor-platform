# ADR-0003 CLI 公共契约与宿主边界

状态为 Proposed，待非作者评审。关联 #2、#7、#8、#10、#14、#16。

## 契约

`@svgframe/core` 公开[四个扩展点](../../packages/core/src/extensions.ts)、[编辑对象与会话投影](../../packages/core/src/model.ts)、[插件上下文](../../packages/core/src/plugin.ts)及 [I/O 端口](../../packages/core/src/ports.ts)。测试专用替身从 `@svgframe/core/testing` 导入。各贡献以类实例注册。每个编辑会话的装饰器实例独立，按成功注册顺序追加后缀。

`Command.requiresDocument` 在校验参数前生效。prepare 返回本次调用的效果，例如无参 canvas 选 query，带尺寸选 document。query 拿到只读快照，edit 提交 EditAction。CLI 和 DSH 可共用 EditorSessionPort 的结构化创建、读取和保存，CLI 自行生成原文案。初始空注册表、四类扩展点的调用以及同类别命令重名可用[契约用例](../../packages/core/test/contracts.test.ts)复核。

属性匹配只读取 ShapeView。零命中沿用原白名单，多命中在写入前拒绝。唯一命中时在候选文档修改，再统一校验、一次提交并通知。处理器写入后抛错时丢弃候选，保留活文档、历史和保存基准。选择候选副本有克隆成本，但沿用 Phase 1 的历史模型，能支持一次修改多个子件。激活和退出失败的运行时回滚属于加载器。测试上下文只记录贡献，FaultAfterWrite 可为事务测试注入候选写入后的故障。

## 验证与后续

契约测试编译一个只使用公开导出的微型插件，并用独立假会话创建、保存和读回。#7 落实真实事务与冲突处理，#8 落实清单和注册回滚，#10 接真实事件，#14 把默认 CLI 连到这些接口。真实 DSH 在 #16 用同一套结构化操作验收。跨模块评审时由这些消费者核对方法和测试覆盖。
