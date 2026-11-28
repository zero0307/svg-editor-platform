# box 双装配独立复核

基线 `9cf8447` 在原冻结提交 `a21f758` 上移植了 `df4fd1d` 中 packages 下的通用回显实现与测试。基线不含 shape-box。A、B 分别重放原接入提交，保留原作者，二者父提交及插件目录的 Git 树对象一致。完整 SHA 见 results.json。

| 方式 | 本地分支 | 提交 | 与基线相比的接入改动 |
|---|---|---|---|
| A | codex/box-code-verified | bcdb30f | 新增插件，在 CLI 组合根显式注册；调整 CLI 依赖、项目引用和锁文件 |
| B | codex/box-config-verified | 30f02c7 | 新增相同插件，在根配置声明模块；调整项目引用和锁文件 |

在 Windows、Node 24.22.3、npm 11.6.2 下分别从新检出执行以下命令，使用离线依赖缓存。两次完整构建退出码均为 0，各自通过全部 30 项 box 独立测试。分别见 install、build、tests 日志和完整文件差异。

```sh
npm ci --offline --registry=https://registry.npmmirror.com --replace-registry-host=always --no-fund --no-audit
npm run build
npm test --workspace @svgframe/shape-box
```

回放从两个新的空工作目录启动，以二进制 stdin 传入集成提交 14a45d7 的 doc/transcript/box.txt。A 执行 node <A>/apps/cli/dist/main.js，B 执行 node <B>/apps/cli/dist/main.js --config <B>/plugins.config.json，其中路径均为对应检出的绝对路径。

两边退出码均为 0，stderr 为空。stdout 各 806 字节，与同一集成提交的 test/fixtures/expected/box/stdout.txt 原始字节完全一致。此用例仅加载 box，未加载 modified-star。两份 SVG 逐字节一致，各 601 字节，SHA-256 同时匹配此前独立保存的 doc/evidence/assembly/compare.json 中的 box 产物摘要。results.json 记录输入、期望值及实际摘要。原始输出和两份 SVG 随附。
