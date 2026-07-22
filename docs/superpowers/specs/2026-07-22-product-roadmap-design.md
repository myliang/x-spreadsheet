# tego-sheet 产品 Roadmap 与设计体系

日期：2026-07-22

## 目标

为 `tego-sheet` 建立一个面向组件/SDK 的长期产品 Roadmap，并为 Roadmap 中每项能力提供可直接转化为实施计划的 Mini-RFC。首要产品主线是“可设计、可绑定、可预览、可输出”的电子表格模板打印与文档生成能力。

本设计同时定义 GitHub Pages 的 Roadmap 呈现方式、能力依赖顺序、共享技术契约和文档维护规则。

## 已决产品约束

- 产品保持可嵌入业务系统的 React 组件与 TypeScript SDK 定位，不发展成内建账号、云存储和任务系统的完整 SaaS。
- 项目尚未正式发布，允许破坏现有 workbook JSON 和公开 API；新契约必须由回归测试锁定，不维护无收益的兼容分支。
- 模板由业务用户在表格编辑器中可视化设计，开发者可通过 TypeScript API 操作同一模板模型。
- 模板表达式采用受限、安全、可替换的 DSL，不执行任意 JavaScript。
- 输出优先级为确定性预览、指定区域的浏览器打印、PDF Blob、XLSX、图片。
- 公式、错误值、日期序列、数字格式和文件互操作以 Excel/XLSX 语义为主要兼容基准；不宣称未验证的完整兼容。
- 模板打印是首个核心里程碑，其他能力按其对模板、渲染和输出的依赖关系排序。

## 非目标

- 不在核心中实现身份、ACL 后端、通知、云存储、实时协作服务或 AI 服务。
- 不承诺 Roadmap 项目的发布日期。
- 不直接复制 docxtemplater 的 Office XML 实现、商业模块或专有模板语法。
- 不让 Canvas、React DOM 或浏览器打印 API成为 workbook、模板或分页模型的事实来源。
- 不在 API 尚未稳定时拆分多个 npm 包。

## 总体架构

采用编译器中心的分层 SDK：

```text
React Spreadsheet / Template Designer / Preview
                    ↓ commands + diagnostics
Workbook Core → Template Compiler → GeneratedDocument
                                      ├─ Preview Adapter
                                      ├─ Isolated Browser Print Adapter
                                      ├─ PDF Adapter
                                      ├─ XLSX Adapter
                                      └─ Image Adapter
```

纯 TypeScript 核心负责文档状态、命令事务、模板编译、数据解析、结构展开、公式重算、分页和诊断。React 层只负责编辑体验、模式切换和受控状态展示。输出适配器不访问可变 controller。

## 共享产品模式

- **Spreadsheet mode**：普通工作表编辑。
- **Template mode**：插入变量，定义条件、重复区域、打印区域、分页、页眉和页脚。
- **Preview mode**：使用样例数据编译模板，展示固定页面和定位诊断。
- **Output mode**：从同一生成结果执行浏览器打印、PDF、XLSX 或图片输出。

## 共享技术对象

```ts
interface SpreadsheetDocument {
  schemaVersion: number;
  workbook: Workbook;
  templates: SpreadsheetTemplate[];
  resources: ResourceStore;
  extensions: ExtensionStore;
}

interface CompiledTemplate {
  templateId: string;
  ir: TemplateIR;
  diagnostics: Diagnostic[];
}

interface GeneratedDocument {
  workbook: RenderedWorkbook;
  print: PrintDocument;
  resources: ResolvedResourceStore;
  diagnostics: Diagnostic[];
  metadata: DocumentMetadata;
}
```

`RenderedWorkbook` 保留公式、单元格类型、样式和 XLSX 打印元数据；`PrintDocument` 保存已经分页的页面与绘制指令，供 Preview、Browser Print、PDF 和图片输出使用。

## 主数据流

```text
SpreadsheetDocument snapshot
  → compile template and collect diagnostics
  → resolve synchronous/asynchronous data and resources
  → expand repeat/conditional structures on an isolated workbook
  → rebuild affected formula dependencies and recalculate
  → create cell presentations
  → paginate with explicit locale/timezone/font metrics
  → produce immutable GeneratedDocument
  → run one or more output adapters
```

结构性修改统一经过 command/transaction。公式、合并、验证、条件格式、模板绑定、打印区域和浮动对象锚点必须在同一事务中转换。

## Roadmap 阶段

### Phase 0：Foundation

- Workbook 2.0 typed document model
- Command / Transaction
- Formula dependency and number-format core
- Shared render semantics and Canvas accessibility layer
- Minimal versioned manifests, built-in cell-type registry and adapter registry kernel

### Phase 1：Template Print MVP

- 指定工作表、选择区域和多个打印区域
- 安全标量绑定、单层重复行和条件区域
- 确定性分页、重复标题、边距与 fit-width
- 页面预览和隔离的浏览器打印

### Phase 2：Document Generation

- 嵌套、横向、区域和逐页重复
- 图片、字体、二维码和异步资源
- PDF Blob、XLSX 模板输出和图片输出

### Phase 3：Spreadsheet Depth

- 条件格式、验证和交互式单元格
- 高级公式、命名范围、数组和函数扩展
- 多列排序、条件筛选、保存视图和数据清理
- 结构化表格、图表、Sparkline、Pivot、Slicer
- Goal Seek 与可插拔 Solver
- CSV/TSV、XLSX、ODS 文件交换

### Phase 4：SDK Ecosystem

- Public Cell Renderer / Editor 与结构化值插件 SDK
- Template Module，以及 Foundation registry kernel 之上的公开 Adapter 生命周期、trust policy 和兼容协议
- Persistence、Collaboration、Permission、Comment 与 Version History Adapter
- 受约束的 AI Command Adapter

## GitHub Pages Roadmap

Roadmap 作为现有页面内的独立 `#roadmap` 区块，不增加路由依赖。页面应：

- 按上述阶段分组展示 planned 项目。
- 明确说明优先级表示依赖与建议顺序，不构成发布日期承诺。
- 只列尚未完成的能力；完成后从 planned 列表移入 shipped 记录，而不是继续显示为待办。
- 将每个能力域链接到 `docs/roadmap/` 中对应 Mini-RFC。
- 将 Host integrations 放在最后，并标注组件只提供协议和 UI 接入点。
- 使用不可交互的状态图标，避免访客把 Roadmap 当作可勾选任务列表。

页面内容必须由一个类型化 Roadmap 数据源驱动，渲染测试校验阶段、项目、状态和设计链接，避免站点文案与设计文档漂移。

## 文档结构

- `docs/roadmap/README.md`：状态、依赖、顺序和 Mini-RFC 索引。
- `docs/roadmap/template-printing.md`：模板打印与文档生成。
- `docs/roadmap/foundation.md`：Workbook、Transaction、Formula/Format、Render Semantics 和 Minimal Extension Kernel。
- `docs/roadmap/formulas-data.md`：格式、验证、公式、数据工具和文件交换。
- `docs/roadmap/analysis-visualization.md`：Table、Chart、Pivot、Slicer、Goal Seek/Solver。
- `docs/roadmap/extensibility.md`：Cell、Template 与 Adapter 插件协议。
- `docs/roadmap/host-integrations.md`：Persistence、Collaboration、Permission、Comment、Version History 和 AI。

每个 Mini-RFC 必须包含产品目标与场景、范围与非目标、UX/API、数据模型、内部模块和数据流、错误/性能/安全边界、破坏性更新策略、分阶段交付、验收标准、依赖和已决决策。

## 错误与诊断契约

```ts
interface Diagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  domain: DiagnosticDomain;
  stage: DiagnosticStage;
  message: string;
  location?: DiagnosticLocation;
  details?: JsonValue;
  cause?: unknown; // runtime only; never serialized
}

interface DiagnosticLocation {
  sheetId?: SheetId;
  range?: CellRange;
  cell?: CellAddress;
  bindingId?: BindingId;
  resourceId?: ResourceId;
  objectId?: ObjectId;
  adapterId?: string;
  commandId?: string;
}

type DiagnosticDomain =
  | 'document' | 'command' | 'formula' | 'format' | 'validation'
  | 'view' | 'data' | 'interchange' | 'template' | 'resource'
  | 'layout' | 'output' | 'extension' | 'analysis' | 'persistence'
  | 'collaboration' | 'permission' | 'comments' | 'history' | 'ai';

type DiagnosticStage =
  | 'decode' | 'validate' | 'plan' | 'commit' | 'compile'
  | 'resolve' | 'expand' | 'recalculate' | 'layout' | 'render'
  | 'serialize' | 'load' | 'save' | 'refresh' | 'execute'
  | 'synchronize' | 'authorize' | 'persist' | 'migrate' | 'dispose';
```

用户模板错误尽量聚合返回；编程契约错误可以抛出异常。所有异步阶段支持 `AbortSignal`，并设置单元格、节点、页数、资源字节、解压大小、时间和内存上限。

## 安全边界

- 表达式禁止原型链、全局对象、赋值和任意函数执行。
- 网络资源默认关闭，由宿主显式提供 resolver。
- SVG、Office ZIP/XML、CSV 和自定义插件分别执行格式校验与资源限制。
- 权限快照用于客户端 UX 和命令校验，但服务端必须再次授权。
- AI 只能生成 schema 校验、dry-run、可预览且需用户确认的 command proposal。

## 测试与验证

- 每个新契约先建立回归测试，再替换旧实现。
- Core 在无 DOM 环境验证 round-trip、事务原子性、公式、模板展开和分页。
- Component tests 验证 Spreadsheet/Template/Preview 模式、属性面板和诊断定位。
- Browser tests 验证真实选择、模板编辑、预览和打印文档隔离。
- Chrome、Firefox、Safari 验证原生打印预览；浏览器原生对话框属于平台行为。
- PDF、XLSX 和图片使用固定 fixture、结构检查和视觉回归。
- XLSX 在 Excel Desktop、Excel for web 和 LibreOffice 中执行互操作验证。
- GitHub Pages Roadmap 使用内容和链接完整性测试。

## 研究依据

- [Docxtemplater 官方仓库](https://github.com/open-xml-templating/docxtemplater)：模板、循环、条件和模块化文档生成基准。
- [Docxtemplater internals](https://docxtemplater.com/docs/deep-dive-into-docxtemplater-internals/)：编译、IR、数据解析和渲染阶段。
- [Google Sheets 打印](https://support.google.com/docs/answer/7663148?hl=en)：Workbook、Current sheet、Selected cells、分页和页眉页脚产品基准。
- [Microsoft Excel Page Setup](https://support.microsoft.com/en-us/excel/page-setup)：Print Area、重复标题、分页、缩放和页眉页脚语义基准。
- [MDN Printing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing)：打印样式、iframe 和打印生命周期。
- [CSS Paged Media](https://www.w3.org/TR/css-page-3/)：纸张、边距和分页媒体标准。

## 完成标准

本设计阶段在以下条件下完成：

1. 总设计和所有能力域 Mini-RFC 均已写入仓库。
2. 每个 Roadmap 项目都有产品定义、技术定义、阶段和验收标准。
3. 跨域对象、术语、阶段和依赖没有冲突。
4. 文档不存在未决占位符或隐含的旧兼容要求。
5. 用户审阅并确认文档后，再创建分阶段实施计划。
