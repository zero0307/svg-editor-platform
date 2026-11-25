# 干净目录安装记录（TASK-DSH-02）

验证目标：在**没有 workspace 软链**的临时目录里安装 `apps/dsh-plugin` 的产物，
用临时 `DSH_HOME`/profile 加载、注册两个工具并卸载。

## 版本与产物

| 项        | 值                                                                   |
| --------- | -------------------------------------------------------------------- |
| DSH       | 0.2.2-rc.5（Desktop 打包，`ELECTRON_RUN_AS_NODE` 运行 `lib/bin.js`） |
| 宿主 Node | 24.21.0                                                              |
| 仓库 Node | 26.13.0                                                              |
| 产物      | `apps/dsh-plugin/dist/plugin.js`                                     |
| 大小      | 292147 字节                                                          |
| sha256    | `51A45AEB79CA25ACB28462A80B721CD51E955BC2EF013FB8F7C8C36BC2EB2FB3`   |

## 步骤与退出码

```powershell
# 1. 干净目录：只复制 package.json / cordis.patch.yml / dist/plugin.js
#    %TEMP%\dsh-wu-16\install\node_modules\@svgframe\dsh-plugin
# 2. 产物自包含检查（在 install 目录内，用仓库外 Node 直接 import）
node --input-type=module -e "await import('./node_modules/@svgframe/dsh-plugin/dist/plugin.js')"
# → exports=apply,inject,name,...  name=svgframe-dsh-plugin inject=["tools","fs"]  （退出码 0）

# 3. 建临时 profile
dsh --profile wu16 --from-default-profile headless --dump-config      # 退出码 0
# 4. 把产物目录复制进 profile 的 node_modules，并在临时 profile 的
#    package.json 追加依赖与 dsh.profile.bundles
# 5. 组合检查
dsh --profile wu16 --dump-config                                      # 退出码 0
# 6. 真实加载
dsh --profile wu16 headless ping                                      # 退出码 1（无模型凭据）
```

## 组合结果（`dump-config.log`）

```
# == @svgframe/dsh-plugin
- id: svgframe-dsh-plugin
  name: '@svgframe/dsh-plugin'
  config:
    log: true
```

## 真实加载 / 卸载（`boot.log`、`boot.err`）

stdout：

```
[svgframe-dsh] registered svg_inspect, svg_create_flowchart

[svgframe-dsh] disposed; registry-residue=none
```

stderr：

```
dsh: MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official"; ...
```

结论：两个工具进入真实宿主注册表，进程退出时 effect 释放，注册表无残留；
退出码 1 仅因本机没有模型凭据，与插件无关。

## 未执行

- 模型侧真实调用两个工具（无 `DEEPSEEK_API_KEY`，`headless` 在模型调用前退出）。
- `plugin add`/`remove` 的 pnpm 流程（临时环境无 pnpm），改用复制 + 临时 profile 清单。

## 卸载与恢复

删除 `%TEMP%\dsh-wu-16` 即回到验证前状态；未改用户 `%USERPROFILE%\.dsh`。
