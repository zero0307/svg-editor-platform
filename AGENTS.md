# SVG Editor Platform 开发约束

先读根 README、CONTRIBUTING、doc/architecture.md、doc/acceptance.md 和当前 Issue。实验原文优先；规格有歧义时记录并确认，不擅自改变验收标准。

## 状态

本仓库已初始化并继承 Phase 1 历史。旧 `src/` 已在 #14 删除；当前运行布局为 `packages/*`（core/svg-xml/host/builtins）与 `apps/*`（cli/vscode-svg/dsh-plugin），根 `test/` 保留 89 项 Phase 1 回归、经公开包入口运行，新增 3 项组合根测试。根入口为 `npm run build`、`npm test`（92 项，含 6 项基线）、`npm run check`、`npm run build:packages`、`npm run test:packages`、`npm run cli`、`npm run verify:visual`（约定见 ADR-0006/ADR-0007）。`plugins/` 与正式业务插件按节点建立，不得把目标目录或计划命令当作现有能力。

## 修改范围

- 在任务指定板块内开发。跨块接口变更先说明影响，再同时更新契约、替身、消费者及 ADR。
- 不要把仓库外的 reference/、phase2-plan/ 材料克隆或嵌套 .git 提交进来；正式方案维护在 doc/。
- 保留 `final` 和旧历史；不 force push、不改标签，不替用户执行未请求的远程写入。
- 新增插件的接入提交不能顺带修改内核、加载器和既有插件；通用能力在框架阶段先完成。

## 代码

- TypeScript strict，ESM；保持面向对象、字段封装、一类一文件，类名与文件名一致。
- 内核只依赖公开领域抽象和扩展点，不能导入 host、Node文件系统、VSCode、DSH或具体插件。
- 插件通过公开API与注入服务协作，不导入其他插件，不访问跨包内部路径。
- 命令需要文档、是否只读、历史策略使用元数据表达；不能在router中按命令名列白名单。
- 处理器只修改事务工作副本；成功一次提交，失败不改变文档、dirty和undo/redo。
- 插件激活只通过宿主暂存上下文注册能力和订阅；失败撤销全部暂存项，A/B共用路径。
- 保留Phase1输出和顺序；新增功能通过注册接入，不随手修改格式或golden文件。

## 验证与文档

- 运行与变更相关的单元、契约和集成检查；新插件须可用测试替身独立测试。
- 现有根检查入口继续可用；工作区命令 `npm run build:packages`、`npm run test:packages` 已建立。执行前读取实际package.json，不声称不存在的命令已通过。
- 更新对应需求条目和必要文档；区分计划、实现和真实测试结果。重要AI纠错记录到doc/records。
- 测试失败或环境缺失时如实报告；不能用README历史描述代替本次验证。
- 不在本任务之外创建、发送消息或修改远程设置。发现需要额外材料时先推进不受影响的工作，再提出具体问题。
