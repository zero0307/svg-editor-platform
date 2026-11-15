# GitHub 协作配置与维护

开发仓库为 [zero0307/svg-editor-platform](https://github.com/zero0307/svg-editor-platform)。维护者已于2026-11-15明确授权公开仓库，代码、历史、文档和Issues按公开项目协作。原Phase1仓库和final标签继续保留。

## 配置来源

| 配置           | 唯一维护位置                                                            | 生效方式                                                       |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| CI             | [.github/workflows/ci.yml](../.github/workflows/ci.yml)                 | GitHub Actions读取实际工作流                                   |
| 主分支保护参数 | [.github/main-protection.json](../.github/main-protection.json)         | 管理员通过GitHub API应用并读取确认；提交文件本身不会自动改设置 |
| 合并策略       | [.github/repository-settings.json](../.github/repository-settings.json) | 管理员应用并读取实际仓库设置                                   |
| 任务内容       | [任务定义](tasks/definitions.json)                                      | 创建或修订Issue时使用；状态以实际Issue为准                     |
| 任务编号与入口 | [任务索引](tasks/index.md)                                              | 链接实际Issue和依赖关系，不另维护一份认领状态                  |

CI、保护和合并策略各有一份来源；`ci/`只放操作说明，不再放第二份工作流模板。不要将管理API使用的令牌、Cookie或本机代理配置放进仓库。

## CI与合并门槛

针对main的PR、main推送及手动运行均执行CI。四组矩阵为Ubuntu/Windows与Node22/24，每组依次检查锁定依赖安装、格式、文档/目录、编译、测试、架构和SVG渲染。汇总job固定为 `CI required`，只有全部矩阵成功才通过。

main的保护目标为：

- 所有修改通过PR，至少一位非作者批准；新提交使旧批准失效。
- `CI required`必须成功，分支需包含最新main；讨论必须解决。
- 管理员同样受保护；禁止force push和删除main。
- 保留merge commit，不要求线性历史；禁用squash与rebase合并。
- 不自动删除全部已合并分支，避免误删evidence分支；普通任务分支按规范手动清理。

保护绑定真实成功产生的GitHub Actions检查来源，不能只创建一个同名“成功”状态代替测试。修改检查名称或矩阵前，先确保新检查可以真实运行，再调整保护参数。

本轮CI/保护配置属于初始化引导：先提交配置PR并完成真实CI与独立审阅，合入后应用正式保护。后续任务按保护后的流程协作，不保留管理员免审旁路。

## Issues认领与依赖

每个任务包含板块、优先级、开发路径、公共接口、排除范围、前置Issue、具体验收和交付证据。任务保持未分配，成员确认后添加Assignee并确定一位跨板块审阅者；使用实际Issue编号建立短期分支。

依赖表示该任务合并和关闭前必须完成的前置工作。允许使用约定测试替身提前开发的部分在Issue中明确说明；不能为了抢先合并而绕过公共契约。GitHub的blocked by关系与正文链接应保持一致，依赖变化先检查是否形成环。

标签按 `area:*` 板块和 `priority:*` 优先级筛选，任务状态以Issue、Assignee和PR为准。关闭Issue须满足全部验收，PR使用 `Closes #编号` 关联。框架冻结门槛完成后才建立正式A/B接入证据，避免把框架补洞混进插件提交。

## 文件组织与交付

当前运行代码仍在src/test，工作区迁移另有任务；不要为认领板块提前建立空包。目录和材料位置见 [文件组织规范](repository-layout.md)。报告入口为 `doc/README.md`，指标按课程要求放 `docs/metrics/`，真实证据放 `doc/evidence/`。

`final`永久保留，`p2`在最终验收通过后创建；当前不创建过程tag。最终验收提交、p2及报告引用的证据分支按既定方案同步回原课程仓库。
