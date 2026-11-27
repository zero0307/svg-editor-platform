# DeepSeek Harness 插件开发

插件由宿主工具和桌面预览组成。两端共用连线几何和 SVG 解析逻辑。安装与操作步骤见[插件使用指南](../apps/dsh-plugin/README.md)。

| 改动位置                                                                                 | 职责                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [工具入口](../apps/dsh-plugin/src/index.ts)                                              | 注册会话工具，从 Harness 注入工作目录、文件服务和沙箱策略。 |
| [绘图与读回](../apps/dsh-plugin/src/SvgTools.ts)                                         | 调用编辑器会话，生成流程图并读回节点、箭头和端口。          |
| [桌面预览](../apps/dsh-plugin/client/preview.jsx)                                        | 管理点选、选区引用、端点预览和另存操作。                    |
| [原稿编辑](../apps/dsh-plugin/src/artwork.ts)                                            | 按选区编辑自由 SVG，保存副本并核对磁盘内容。                |
| [会话适配器](../src/bootstrap/Phase1EditorSession.ts)                                    | 将公共会话接口接到 Phase 1 编辑器。                         |
| [市场条目](../apps/dsh-plugin/market/zero0307__svg-editor-platform--apps-dsh-plugin.yml) | 描述插件、支持的用法和发行包地址。                          |

## 从源码打包

从仓库根目录执行以下命令。项目支持 Node.js 22 及以上，建议用 Node.js 24 构建。最后一条命令在当前目录生成可安装的 tgz 文件。

```sh
npm ci
npm run build
npm pack --workspace dsh-svg-editor
```

安装至 Harness 0.2.2-rc.5 后，打开会话的工作区文件即可使用预览。修改客户端时重新打包并安装以加载新资源。插件包包含桌面客户端和工具的运行时代码、使用指南与许可证。宿主提供 React 与 Harness 服务。

## 发行维护

当前发行流程针对 0.14.2。发行版本进入主分支且必需 CI 通过后，工作流打包，发布 GitHub Release 及 SHA-256 校验文件，并从公开地址下载比对。准备下一版本时，同步调整插件版本、市场条目下载地址和工作流的版本条件。市场收录由社区市场单独处理。[发行工作流](../.github/workflows/ci.yml)
