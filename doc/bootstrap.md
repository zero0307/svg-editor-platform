# 新成员开工与仓库维护

开发仓库已继承 Phase 1 的完整 Git 历史和所有原始标签。新成员直接克隆本仓库，不需要重复导入原仓库或重新初始化历史。运行代码目前仍为 Phase 1 布局，Phase 2 按 [路线](roadmap.md) 推进。

## 1. 克隆并配置环境

```sh
git clone https://github.com/zero0307/svg-editor-platform.git
cd svg-editor-platform
git remote add upstream https://github.com/zero0307/svg-editor-cli.git
git fetch --tags upstream
git rev-parse 'final^{commit}'
```

`origin` 为团队开发仓库，`upstream` 为 Phase 1 来源和最终课程交付仓库。`final^{commit}` 应为 `e5621a68afd4731626d54566f17ba55885d1bc0f`；不要改动旧标签。

按 `.nvmrc` 使用 Node.js 24.22.1。若使用 nvm，执行 `nvm install`、`nvm use`；其他版本管理器选择相同版本即可。当前 CLI 仍保持原有 Node >=22 的兼容声明，未来 DSH 集成单独核对其版本要求。

```sh
npm ci
npm run check
npm run verify:visual
```

首次复验后再开始任务。使用现有 `package-lock.json`，不在功能分支随意更换包管理器或升级依赖。初始化时的实际环境和结果见 [初始化记录](initialization.md)。

## 2. 认领板块任务

从 [板块与任务清单](roadmap.md) 选择当前可开工任务，使用 GitHub 任务模板填写负责目录、前置接口、负责人、评审人和验收条件。公共框架、VSCode 独立原型、DSH 最小加载验证可并行；正式插件接入证据需要等待框架基线稳定。

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/123-short-description
```

`123` 替换为实际 Issue 编号，分支类型按任务使用 `feat/`、`fix/`、`test/`、`docs/` 或 `chore/`。提交前运行相关检查，并按 PR 模板填写实际结果。

## 3. 初始化范围与后续配置

本次初始化直接在原 Phase 1 `main` 后追加规范和记录提交，是空仓库导入的引导步骤。后续功能通过 PR、跨板块审阅和 merge commit 集成，详见 [贡献规范](../CONTRIBUTING.md)。

已纳入开发方案、板块划分、需求矩阵、Issue/PR模板、ADR与过程模板、两份原始规格、架构源图以及Phase1报告归档。`apps/`、`packages/`、`plugins/` 是目标布局，尚未建立运行包。

CI实际入口为 `.github/workflows/ci.yml`；保护门槛、仓库合并设置见 [GitHub协作配置](github-operations.md)。任务已建立在 [Issues索引](tasks/index.md)，成员认领后补Assignee和审阅者；CODEOWNERS等待实际账号映射，不创建占位账号。

## 4. 保留验收证据

`final` 永久保留，`p2` 仅在完整验收完成后建立。VSCode、框架、命令、box、标签等过程节点使用普通 commit。A/B演示的 `evidence/*` 分支在共同框架基线完成后建立，保留原始接入提交SHA及完整回放证据，不提前创建没有实际证明内容的证据分支。

## 5. 同步课程交付

开发期间以 `origin` 为主协作入口。最终发布前 fetch 原仓库最新主分支；若存在新的改动，先合并并重新验证，再同步同一最终提交，不能强推覆盖。

正式交付时将最终 `main`、`p2`，以及报告引用的 `evidence/*` 分支同步到原仓库；新旧仓库中的验收引用保持一致。当前初始化只写入新仓库，原仓库保留原状。维护者已明确选择公开新仓库，最终报告、标签和证据按评阅路径核对可访问性。
