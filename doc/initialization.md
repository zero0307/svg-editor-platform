# 仓库初始化记录

日期：2026-11-15（Asia/Shanghai）。维护者已授权按开发方案初始化并推送 `zero0307/svg-editor-platform`。

## 历史继承

从 Phase 1 的完整克隆继续开发，并向原仓库重新 fetch 核对引用。原仓库共有 11 个可达提交和 5 个标签，已全部保留。

| 项目             | 结果                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Phase 1 来源     | `https://github.com/zero0307/svg-editor-cli.git`                     |
| 团队开发仓库     | `https://github.com/zero0307/svg-editor-platform.git`                |
| Phase 1 基线提交 | `e5621a68afd4731626d54566f17ba55885d1bc0f`                           |
| final 标签对象   | `25c263bda5515816d59efb383a3790dd2c77df3a`                           |
| final 解引用提交 | `e5621a68afd4731626d54566f17ba55885d1bc0f`                           |
| 完整历史与旧标签 | 对比原克隆的可达提交及标签对象，全部保留                             |
| 原运行代码与依赖 | `src/`、`test/`、`examples/`、`scripts/`、package/lock及TS配置无差异 |
| Phase 1 报告     | 原样归档至 `doc/phase1-report.md`，相对资源链接保持                  |
| Phase 2 规格     | 与提供的原文件逐字节一致                                             |

可复核的提交列表、标签对象、保护路径与SHA-256见 [history.json](evidence/bootstrap/history.json)。没有重写原历史、移动 `final`、创建 `p2`，也没有向原仓库推送。

## 初始化内容

- 合并项目 README 和报告入口，保留原有运行命令、功能范围和历史报告。
- 纳入开发方案、架构、板块与任务依赖、验收矩阵、贡献规范和 AI 开发约束。
- 加入 Issue、PR、ADR及过程记录模板，记录已接受的初始化决策 ADR-0001。
- 保留两份课程规格和 Phase 1 示例、测试、架构及视觉证据。
- 使用 `.nvmrc` 固定团队 Node.js 24.22.1；原 package.json 的 CLI兼容声明保留。
- Prettier忽略原始 Phase 2 规格及 Phase 1 报告归档，避免格式化改写原文。

本轮没有实现工作区重构、插件、VSCode扩展或DSH运行时；目标目录仍按路线文档逐步建立。CI仍为继承的模板，分支保护、成员映射和CODEOWNERS待配置。

## 本地验证

本次使用 Node.js 24.22.1 和 npm 11.6.2。Node 来自桌面提供的运行时，npm 临时准备在仓库外，不修改系统安装；仓库沿用原 lockfile 执行 `npm ci`。

| 检查                  | 本次结果                                                         | 证据                                                                                       |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| npm ci                | 成功，沿用原锁文件；依赖元数据无变化                             | 原 package-lock.json、历史差异核对                                                         |
| npm run check         | 通过：格式检查、严格编译、83项测试、架构检查38文件/115条内部导入 | [check.log](evidence/bootstrap/check.log)                                                  |
| npm run verify:visual | 通过：400×200变换示例渲染前后像素差为0                           | [visual.log](evidence/bootstrap/visual.log)、[报告](evidence/bootstrap/visual-report.json) |
| 文档链接与代码围栏    | 检查当前项目文档和模板，本地链接无缺失                           | [verification.json](evidence/bootstrap/verification.json)                                  |
| 原始报告与规格        | 报告归档及Phase2原文逐字节保留                                   | [history.json](evidence/bootstrap/history.json)                                            |

以上为本次本地复验，不代表远程CI或跨平台验证已完成。原规格中的两张示例图片未随材料提供，原文保留该引用；项目自身文档与模板的本地链接已检查。

## 后续开发与交付

初始化是空仓引导，后续按 [贡献规范](../CONTRIBUTING.md) 通过任务分支和PR协作。先固定原行为回放和公共契约，再按 [板块路线](roadmap.md) 并行实现。

原仓库保留为 `upstream`，新仓库为 `origin`。最终验收后再同步同一最终提交、`p2`及报告引用的证据分支。当前不设置虚构完成日期或成员账号，新增任务以实际Issue编号认领。
