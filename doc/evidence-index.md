# 证据索引

本文件是跨节点的证据入口：列出被测提交、受保护引用、证据路径、可复现命令、环境与未执行项。单个节点的逐条验收见 `doc/evidence/acceptance/`，不在本文件重复。

## 当前冻结基线 F

| 项目         | 值                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 提交         | `a21f758bf072a7d8c0ff683bc579db124c6d209d`（简称 `a21f758`）                                                                                   |
| 受保护引用   | 分支 `evidence/p2-framework-base`（本地与 `origin` 都指向同一提交）                                                                            |
| 标签         | 无（冻结阶段不打 tag；`p2` 由 `#22` 在验收提交上创建）                                                                                         |
| 组件         | 框架完整、业务插件未接入：`packages/{core,host,svg-xml,builtins}`、`apps/{cli,vscode-svg,dsh-plugin}`；`plugins.config.json` 的 `plugins` 为空 |
| 冻结证据     | [framework/freeze.json](evidence/framework/freeze.json)（SHA、配置哈希、14 个输入文件 sha256）                                                 |
| 冻结会话输入 | `doc/transcript/baseline-{basic,flowchart,io,dir}.txt`、`test/fixtures/svg/other.svg`、`test/fixtures/dir/`                                    |
| 目录重建协议 | `test/fixtures/dir/inventory.json` + [framework/freeze.json](evidence/framework/freeze.json) 的 `directoryProtocol`                            |

## 证据目录

| 里程碑           | 路径                                                                             | 内容                                                     |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Phase 1 基线     | [evidence/baseline/README.md](evidence/baseline/README.md)                       | golden、四会话退出码、规格差异、生成与比较日志           |
| M2 框架冻结（F） | [evidence/framework/extension-points.md](evidence/framework/extension-points.md) | 四扩展点契约/调用位置/实现/缺省/错误测试                 |
| M2 环境          | [evidence/framework/environment.json](evidence/framework/environment.json)       | Node/npm/TypeScript/OS、`.nvmrc` 差异、实测命令          |
| M2 检查          | [evidence/framework/check.log](evidence/framework/check.log)                     | `npm run check` 原始输出                                 |
| M2 指标          | [evidence/framework/metrics-v1.log](evidence/framework/metrics-v1.log)           | `final^{commit}` → F 的指标生成日志                      |
| 指标产物         | [docs/metrics/README.md](../docs/metrics/README.md)                              | `e5621a6-to-a21f758.json`、`summary.md`、重算说明        |
| 节点验收         | `doc/evidence/acceptance/`                                                       | `001-qa-01`、`012-met-01`、`015-frame-01` 逐条对照 Issue |

## 命令

```bash
npm test                    # 根测试 101 项（含 6 项 Phase 1 基线与 9 项框架验收）
npm run test:packages       # 工作区 203 项（core 96、host 39、svg-xml 36、dsh 7、vscode 25）
npm run check               # 格式、文档、根测试、包构建、包测试、架构检查
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to a21f758 --out docs/metrics
node scripts/baseline/compare.mjs --entry apps/cli/dist/main.js
```

## 环境

Windows `win32 x64`，Node `v26.13.0`，npm `12.2.1`，TypeScript `7.0.2`。`.nvmrc` 固定 `24.22.1`，本次全部实跑都在 Node 26 上完成；未在 Node 22/24、Linux 或 macOS 上执行，也未运行 CI。

## 未执行项

- `#17`–`#20` 的 C_A/C_B 证据分支与真实插件接入（本索引只冻结 F，不提前建立接入提交）。
- `#21` 的完整 A/B 回放、`#22` 的 p2 指标与发布清单。
- 真实 VSCode Extension Host 与真实 DSH 会话的安装演示（由 V/D 板块单独记录）。
- 跨平台与 Node 22/24 检查；`npm run verify:visual` 未作为冻结门槛重跑。
