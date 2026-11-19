# 持续集成与合并检查

实际工作流唯一维护在 [.github/workflows/ci.yml](../.github/workflows/ci.yml)。原 `ci/github-actions.yml` 模板已迁出当前树，历史版本保留在 `final`；不要同时维护两份CI配置。

## 检查范围

工作流对推送到main、针对main的Pull Request及手动触发运行，不按文件路径跳过。Ubuntu与Windows各验证Node22、24，矩阵失败时其他组仍继续。

每组执行 `npm ci`、`npm run check`、`npm run verify:visual`。根检查覆盖格式、文档、严格编译、83 项 Phase 1 测试、工作区测试、三组逐字节回放及依赖边界。单包可运行 `npm test -w @svgframe/core`。新增 TypeScript 包须登记根项目引用与公开 exports。CLI仍兼容Node22；DSH后续集成的独立版本要求不能由这个矩阵代替。

固定汇总检查名为 `CI required`。它始终等待全部矩阵组，只有上游结果为success时才通过；失败、取消或跳过均不能变为通过。分支保护只绑定这一稳定检查，矩阵展示名可随任务增加，但不能绕过汇总检查。

## 运行与故障处理

从仓库Actions页面查看当前提交和PR的真实结果。日志报错时先在相同Node版本运行本地命令，提交修复后重新等待CI；不把红色检查改为可选或直接跳过测试。文档变更也需要通过链接和格式检查。

工作流使用GitHub托管runner、只读contents权限、完整Git历史和锁文件缓存。checkout不保留写入凭据；并发更新同一PR时取消旧运行，保留最新提交。文本文件采用仓库既有LF规则，并明确二进制文件类型。

## 维护约定

只修改实际工作流，不恢复旧模板。新增npm脚本同时更新文档；新增依赖提交锁文件。更新required检查名称时先让新检查真实成功运行，再更新保护规则，避免把所有PR锁在不存在的检查上。

仓库设置、分支保护和实际验证记录见 [GitHub协作配置](../doc/github-operations.md)；本地文件组织要求见 [目录规范](../doc/repository-layout.md)。
