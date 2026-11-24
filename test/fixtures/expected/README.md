# 期望输出（golden）维护规则

本目录保存经过审阅的行为基线。`baseline-final/` 是 Phase 1 `final` 的实际输出，按会话分目录：

```text
baseline-final/
  provenance.json        # 标签对象 SHA、解引用提交 SHA、Node、生成命令、安装方式
  <session>/stdout.txt   # 原始标准输出，UTF-8/LF
  <session>/stderr.txt   # 原始标准错误
  <session>/exit-code.txt
  <session>/files/**     # 会话保存的产物（SVG 等），逐字节比对
  <session>/files.sha256 # 产物清单
```

规则：

- golden 只能由 `node scripts/baseline/record.mjs ... --update` 生成，生成源必须是 `final` 或明确标注的受测提交；不允许用新实现输出覆盖旧基线。
- 修改 golden 必须同时给出依据（规格条款、ADR 或缺陷修复），并在 [doc/evidence/baseline/spec-diff.md](../../../doc/evidence/baseline/spec-diff.md) 或对应记录中说明。
- 期望文本保持 UTF-8 与 LF；不要提交含绝对路径、时间戳或本地用户目录的输出。
- 会话输入在 [doc/transcript](../../../doc/transcript/)，不要写进 golden；输入与期望输出必须分离。
- 回放方式见 [scripts/baseline/README.md](../../../scripts/baseline/README.md)。
