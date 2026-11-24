# 工程网络图（22 个开发任务依赖关系）

本图依据 [definitions.json](definitions.json) 的 `depends_on` 字段生成，节点为 `TASK-*` 任务，箭头 `A --> B` 表示"A 完成前 B 不能正式开始"。颜色按板块区分，红色为里程碑门槛。

- 无入边的节点为**可立即开工**的任务（`#1`、`#2`、`#3`、`#4`）。
- 唯一终点为 `#22 QA-03`（发布 p2）。
- 框架主线（甲+乙）为：`#2 → #5 → #7/#6/#8/#9/#10 → #13 → #14 → #15 → #21 → #22`。

```mermaid
flowchart TD
    %% ============ 启动层（无依赖，立即开工） ============
    QA01["#1 QA-01<br/>Phase 1 基线回放"]
    CORE01["#2 CORE-01<br/>四扩展点契约"]
    VSC01["#3 VSC-01<br/>SVG 文件标记"]
    DSH01["#4 DSH-01<br/>最小插件加载/卸载"]

    %% ============ 工程地基 ============
    ENG01["#5 ENG-01<br/>workspaces + 包边界检查"]

    %% ============ 框架并行层 ============
    CORE02["#7 CORE-02<br/>文档事务 + 结构不变量"]
    CORE03["#10 CORE-03<br/>树展示 + 行尾装饰管线"]
    HOST01["#8 HOST-01<br/>双装配加载器 + 回滚"]
    HOST02["#9 HOST-02<br/>文件/目录宿主适配器"]
    XML01["#6 XML-01<br/>中立 XML 语法入口"]
    XML02["#13 XML-02<br/>provider 严格 codec"]
    MET01["#12 MET-01<br/>Git 历史指标脚本"]

    %% ============ 关键集成 ============
    CLI01["#14 CLI-01<br/>默认命令 + 六种图形插件化"]

    %% ============ 冻结门槛 ============
    FRAME01["#15 FRAME-01<br/>框架冻结（门槛）"]

    %% ============ 插件 + 独立产品线 ============
    CMD01["#17 CMD-01<br/>stats 命令插件"]
    CMD02["#18 CMD-02<br/>dir 命令插件"]
    BOX01["#19 BOX-01<br/>box + 属性 + 标签"]
    TREE01["#20 TREE-01<br/>modified-star 标签"]
    VSC02["#11 VSC-02<br/>Outline + VSIX"]
    DSH02["#16 DSH-02<br/>svg_inspect / svg_create_flowchart"]

    %% ============ 收尾 ============
    QA02["#21 QA-02<br/>接入差异 + 完整 A/B 回放"]
    QA03["#22 QA-03<br/>报告 + 指标 + 发布 p2"]

    %% ============ 依赖边 ============
    QA01 --> ENG01
    CORE01 --> ENG01
    ENG01 --> CORE02
    ENG01 --> CORE03
    ENG01 --> HOST01
    ENG01 --> HOST02
    ENG01 --> MET01
    CORE01 --> XML01
    CORE02 --> XML02
    XML01 --> XML02
    XML01 --> VSC02
    VSC01 --> VSC02
    CORE02 --> CLI01
    CORE03 --> CLI01
    HOST01 --> CLI01
    HOST02 --> CLI01
    XML02 --> CLI01
    QA01 --> CLI01
    CLI01 --> FRAME01
    MET01 --> FRAME01
    FRAME01 --> CMD01
    FRAME01 --> CMD02
    FRAME01 --> BOX01
    FRAME01 --> TREE01
    FRAME01 --> QA02
    CMD01 --> QA02
    CMD02 --> QA02
    BOX01 --> QA02
    TREE01 --> QA02
    DSH01 --> DSH02
    CLI01 --> DSH02
    QA02 --> QA03
    VSC02 --> QA03
    DSH02 --> QA03
    MET01 --> QA03

    %% ============ 样式 ============
    classDef f fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef q fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef p fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef v fill:#ede9fe,stroke:#7c3aed,color:#3b0764
    classDef d fill:#ffe4e6,stroke:#e11d48,color:#881337
    classDef gate fill:#fecaca,stroke:#b91c1c,color:#7f1d1d,font-weight:bold

    class QA01,MET01,QA02 q
    class CORE01,ENG01,CORE02,CORE03,HOST01,HOST02,XML01,XML02,CLI01 f
    class CMD01,CMD02,BOX01,TREE01 p
    class VSC01,VSC02 v
    class DSH01,DSH02 d
    class FRAME01,QA03 gate
```

## 图例

| 颜色       | 板块       | 任务                          |
| ---------- | ---------- | ----------------------------- |
| 蓝         | F 框架     | #2 #5 #6 #7 #8 #9 #10 #13 #14 |
| 黄         | Q 集成     | #1 #12 #21                    |
| 绿         | C/B/T 插件 | #17 #18 #19 #20               |
| 紫         | V VSCode   | #3 #11                        |
| 粉         | D DSH      | #4 #16                        |
| 红（加粗） | 里程碑门槛 | #15 框架冻结、#22 发布 p2     |

## 关键主线与两条独立产品线

- **框架主线（最长的依赖链，必须优先保障）**：`#2 → #5 → (#7/#10/#8/#9/#6) → #13 → #14 → #15 → #21 → #22`
- **VSCode 独立线**：`#3 → #11`（#11 额外依赖 #6 的 XML 语法入口）
- **DSH 独立线**：`#4 → #16`（#16 额外依赖 #14 的公开运行时）
- **插件组**：`#17/#18/#19/#20` 在 `#2` 契约出来后即可用 fake 并行开发，但正式接入统一卡在 `#15` 之后。
