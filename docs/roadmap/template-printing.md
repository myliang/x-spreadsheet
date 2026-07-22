# 模板打印与文档生成 Mini-RFC

**Status:** planned
**Owner:** tego-sheet core team
**Product boundary:** 可嵌入业务系统的组件与 TypeScript SDK
**Priority:** Roadmap 首要能力域
**Depends on:** [Foundation Mini-RFC](./foundation.md)

## 1. 总体定义

模板打印不是现有 `print(): void` 的增量增强，而是一条新的文档编译流水线。用户在电子表格中设计模板，开发者通过同一份模型传入结构化数据，SDK 将模板编译、绑定、展开、重算并生成不可变的 `GeneratedDocument`；其中的 `PrintDocument` 交给预览、浏览器打印、PDF 和图片适配器，语义化 `RenderedWorkbook` 交给 XLSX 适配器。

产品主线固定为：**可设计、可绑定、可诊断、可预览、可输出**。首要输出顺序为：

1. 浏览器内确定性打印预览；
2. 只包含目标工作表或区域的浏览器打印；
3. PDF `Blob`；
4. XLSX 模板结果；
5. SVG/PNG 图片。

预览、浏览器打印和 PDF 必须消费同一次分页产生的页面几何。XLSX 消费同一次模板渲染产生的语义化工作簿，不能从截图、Canvas 或 SVG 反向生成。

### 1.1 已决架构决策

- 采用编译器中心的分层 SDK：`template -> compile -> resolve/expand -> recalculate -> paginate -> GeneratedDocument -> adapters`。
- 组件保持 SDK 边界；模板存储、账号、权限、任务队列、远程数据源和云打印由宿主实现。
- 业务用户通过表格 UI 创建模板，开发者通过 TypeScript API 创建和检查同一数据模型；JSON 不是业务用户入口。
- 模板表达式采用安全的受限 DSL，禁止执行任意 JavaScript。
- 模板绑定以独立元数据为真相来源；单元格内可见标签只是编辑表现，编译器不依赖扫描任意字符串恢复结构。
- 允许破坏性更新。旧的无参数 `print()`、旧打印 Canvas 挂载逻辑和旧数据模型不会保留并行兼容实现。
- 浏览器原生打印对话框属于平台边界，SDK 保证纸面只包含目标内容，但不承诺静默打印。
- Roadmap 中本能力域所有项目状态均为 `planned`，交付顺序由本文阶段定义。

### 1.2 共享核心契约

```ts
interface SpreadsheetTemplate {
  id: TemplateId;
  name: string;
  bindings: TemplateBinding[];
  printProfiles: PrintProfile[];
}

interface CompiledTemplate {
  templateId: TemplateId;
  sourceDocumentHash: string;
  ir: TemplateIR;
  diagnostics: Diagnostic[];
  compilerVersion: string;
}

interface RenderRequest {
  template: CompiledTemplate;
  currentDocumentHash: string;
  data: unknown;
  profileId: PrintProfileId;
  missingValue: 'error' | 'warning-and-blank';
  signal?: AbortSignal;
}

interface GeneratedDocument {
  workbook: RenderedWorkbook;
  print: PrintDocument;
  resources: ResolvedResourceStore;
  diagnostics: Diagnostic[];
  metadata: DocumentMetadata;
}

interface OutputAdapter<Result> {
  readonly manifest: AdapterManifest;
  render(document: GeneratedDocument, options: unknown): Promise<Result>;
}
```

`SpreadsheetTemplate` 是 `SpreadsheetDocument.templates` 中的定义，只保存绑定和打印配置；它始终引用同一文档中的 `workbook`，不嵌入第二份工作簿。编译器以完整文档和 `templateId` 为输入，并将规范化源文档哈希写入编译产物。Controller 创建 `RenderRequest` 前计算当前文档哈希，并将其作为 `currentDocumentHash` 传入；renderer 必须验证它与 `CompiledTemplate.sourceDocumentHash` 相等，否则以 `TEMPLATE_SOURCE_STALE` 失败。直接使用无 controller 的 SDK 调用方也必须从当前文档计算并显式提供该哈希，因此不会仅依赖产物元数据宣称防过期。

`GeneratedDocument` 是一次渲染会话的不可变产物。预览、打印和 PDF 使用其中的 `print`；XLSX 使用 `workbook`、打印配置和资源；图片适配器使用指定的 `PrintPage`。适配器不得回读可变 controller，也不得修改输入。

### 1.3 共享诊断与资源限制

模板编译、资源解析、布局和输出均复用 Foundation 的共享 `Diagnostic`；模板位置分别写入 `location.bindingId`、`location.resourceId`、`location.sheetId` 或 `location.range`，不维护第二份诊断接口。

```ts
interface RenderLimits {
  maxExpandedCells: number;
  maxExpandedRows: number;
  maxPages: number;
  maxResources: number;
  maxResourceBytes: number;
  maxTotalResourceBytes: number;
  maxResolveConcurrency: number;
  maxLayoutTimeMs: number;
}
```

限制值由 SDK 提供保守默认值并允许宿主向下收紧或显式调高。达到限制必须终止当前会话并返回稳定诊断，不得继续消耗内存。所有异步阶段传播同一个 `AbortSignal`。

---

## TP1. Template Print MVP

**Status:** planned
**Delivery:** Phase 1

### 产品目标与场景

让用户在现有表格编辑体验中完成发票、报价单、标签、合同附表和业务报表模板，传入一份数据后得到可预测的打印预览，并只打印指定工作表或区域。开发者能够在无 React、无 DOM 环境中编译和验证模板。

产品提供四种使用状态：

- `spreadsheet`：编辑普通工作簿内容；
- `template`：插入变量、定义重复区域、条件区域、打印范围和分页配置；
- `preview`：使用样例数据编译并展示固定页面与诊断；
- `output`：通过 SDK 请求浏览器打印或其他适配器输出。

典型流程为：选中单元格或区域 → 在右侧模板面板创建绑定 → 输入或选择数据路径 → 配置格式化与空值行为 → 选择打印范围和纸张 → 传入样例数据 → 查看诊断及分页预览 → 输出。

### 范围

- 标量值绑定、单层纵向重复行、条件显示区域。
- 指定工作表、单一区域和多个不连续区域。
- 多个不连续区域按声明顺序各自从新页开始。
- A4、A5、Letter、自定义纸张；横纵向、边距、固定缩放、适应页宽和适应整页。
- 重复标题行/列、手工分页、网格线和行列标题开关。
- 页眉页脚的静态文本、页码、总页数、日期和模板数据字段。
- 同一 `PrintPage[]` 驱动页面预览和浏览器打印。
- 编译期聚合诊断、样例数据预览和模板位置高亮。
- 模板展开后复制样式、合并、验证和公式引用，并统一重算。

### 非目标

- 嵌套循环、横向重复、任意区域重复、每条数据一页和子模板。
- PDF、XLSX 和图片文件输出；这些由后续适配器交付。
- 静默打印、控制打印机、控制浏览器原生打印对话框。
- 模板库、审批、权限、云存储、定时任务或服务端打印。
- 执行模板中的 JavaScript、访问浏览器全局对象或宿主凭证。

### UX 与公开 API

模板模式使用表格画布上的非打印装饰：值绑定显示标签，重复区域和打印区域显示不同边框，冲突区域显示错误色。右侧属性面板是所有绑定和打印配置的正式编辑入口。属性面板中的选择与画布选区双向定位；删除标签等同于执行删除绑定命令。

预览模式包含页面列表、当前页缩放、页数、纸张配置和诊断面板。错误阻止输出；warning 允许输出但必须可见。预览不得写回模板工作簿。

```ts
interface TemplateCompiler {
  compile(
    document: SpreadsheetDocument,
    templateId: TemplateId,
    options: CompileOptions,
  ): CompilationResult;
}

interface CompilationResult {
  template?: CompiledTemplate;
  diagnostics: Diagnostic[];
  hasErrors: boolean;
}

async function renderSpreadsheetTemplate(
  request: RenderRequest,
  environment: RenderEnvironment,
): Promise<GeneratedDocument>;

interface BrowserPrintAdapter {
  print(
    document: GeneratedDocument,
    options?: BrowserPrintOptions,
  ): Promise<BrowserPrintResult>;
}
```

React 入口使用文档和模式作为显式输入：

```tsx
<TegoSheet
  document={document}
  mode="template"
  sampleData={sampleData}
  onDocumentChange={setDocument}
  onDiagnostics={setDiagnostics}
/>
```

`mode` 只能为 `spreadsheet | template | preview`；输出由 ref 或独立 SDK 触发，不增加隐藏的第四种可编辑状态。

### 数据模型

```ts
type TemplateBinding =
  | ValueBinding
  | RepeatRowsBinding
  | ConditionalRangeBinding;

interface ValueBinding {
  id: BindingId;
  type: 'value';
  target: CellAddress;
  expression: ExpressionSource;
  formatter?: FormatterReference;
}

interface RepeatRowsBinding {
  id: BindingId;
  type: 'repeat-rows';
  range: CellRange;
  source: ExpressionSource;
  empty: 'remove' | 'keep-template-row';
  pageBreak: 'auto' | 'before-each-item';
}

interface ConditionalRangeBinding {
  id: BindingId;
  type: 'conditional-range';
  range: CellRange;
  when: ExpressionSource;
}

interface PrintProfile {
  id: PrintProfileId;
  name: string;
  targets: PrintTarget[];
  page: PageSetup;
  repeatRows?: CellRange;
  repeatColumns?: CellRange;
  manualBreaks: PageBreak[];
  header?: PageBand;
  footer?: PageBand;
  showGridlines: boolean;
  showHeadings: boolean;
}

type PrintTarget =
  | { type: 'sheet'; sheetId: SheetId }
  | { type: 'range'; range: CellRange }
  | { type: 'ranges'; ranges: CellRange[] };
```

`CellRange` 自身携带唯一 `sheetId`；`PrintTarget` 不重复声明工作表来源。`ranges` 按数组顺序输出，可跨工作表，每个不连续区域从新页开始。

结构绑定必须使用稳定 ID 和显式区域。MVP 中两个结构绑定不得重叠；合并单元格不得跨越重复区域边界。表达式 AST 支持属性访问、字面量、算术、比较、布尔运算、空值合并、条件表达式和注册的纯 formatter。循环作用域提供当前项、`$index`、`$first`、`$last` 和只读根数据；禁止赋值、构造函数、原型链属性、动态代码求值和宿主对象访问。

### 内部模块与数据流

```text
TemplateEditor commands
  -> SpreadsheetTemplate snapshot
  -> TemplateParser / ExpressionParser
  -> TemplateValidator
  -> immutable TemplateIR
  -> DataResolver
  -> RepeatRowsExpander / ConditionalExpander
  -> FormulaRecalculator
  -> CellPresentationResolver
  -> PrintPaginator
  -> PrintDisplayList + PrintPage[]
  -> GeneratedDocument
  -> PreviewAdapter / BrowserPrintAdapter
```

编译缓存键由模板结构哈希、编译器版本、函数注册表版本和 formatter 注册表版本组成。渲染会话从 `CompiledTemplate` 生成隔离工作副本，不修改模板、controller 或调用方数据。字体度量、locale、时区、日期系统和资源 resolver 均由 `RenderEnvironment` 显式注入。

浏览器打印适配器创建独立、同源的隐藏 iframe，写入每页 SVG、已解析字体和打印 CSS，等待字体及资源可用后调用 iframe 的 `print()`。清理同时监听 `afterprint`，并设置超时和显式 `dispose()` 兜底。iframe 不挂载编辑器 React 树，因此工具栏、对话框和模板面板不会进入打印内容。

### 错误、性能与安全

稳定错误码至少包括：`INVALID_EXPRESSION`、`UNKNOWN_FORMATTER`、`MISSING_DATA`、`OVERLAPPING_REPEAT_REGION`、`INVALID_PRINT_TARGET`、`MERGE_CROSSES_REPEAT_BOUNDARY`、`ROW_EXCEEDS_PAGE`、`PAGE_LIMIT_EXCEEDED`、`FONT_UNAVAILABLE`、`PRINT_BLOCKED` 和 `RENDER_ABORTED`。

- 编译一次返回全部可定位的语法和结构错误。
- 缺失数据默认是 error；profile 可显式改为 warning 并输出空白。
- 单行高于可打印区域时不得无限重试分页，返回 `ROW_EXCEEDS_PAGE` 并阻止输出。
- 表达式求值器只解释已验证 AST；注册函数接收冻结输入和能力受限上下文。
- iframe 使用最小 DOM、无脚本页面和受控资源 URL；输出结束撤销所有 Object URL。
- 对展开单元格数、页数、编译时间、布局时间和缓存大小实施限制。

### 迁移与破坏性更新策略

- 删除 `TegoSheetHandle.print(): void`，由带 profile 的输出命令或独立 `BrowserPrintAdapter.print()` 取代。
- 删除主文档中隐藏兄弟节点、临时挂载 Canvas 的打印路径。
- 现有 workbook JSON 通过一次性迁移器导入 Workbook 2.0；新序列化器只输出新 schema。
- 在一个发布周期内提供迁移文档和开发期诊断，不在运行时维护两套打印实现。
- 现有打印回归用例改写为目标区域、页面几何、iframe 隔离和清理生命周期测试。

### 分阶段交付

1. **TP1-A 编译基础：** 模板/绑定/打印 profile schema、安全表达式、聚合诊断和无 DOM 编译测试。
2. **TP1-B 区域打印：** 单工作表、单/多区域、纸张、边距、缩放、重复标题和确定性分页。
3. **TP1-C 模板展开：** 值绑定、单层重复行、条件区域、公式重算和结构元数据转换。
4. **TP1-D 设计体验：** 模板模式、属性面板、区域装饰、样例数据和诊断定位。
5. **TP1-E 输出闭环：** SVG 预览、隔离 iframe 打印、跨浏览器验证和旧打印路径删除。

### 验收标准

- 指定工作表或区域打印时，页面中不存在区域外单元格及任何编辑器 UI。
- 相同模板、数据、字体度量、locale、时区和 profile 产生相同页数、页面尺寸和单元格几何。
- 多区域严格按声明顺序输出且各自从新页开始。
- 重复行正确复制值、样式、合并、验证和相对公式引用；绝对引用保持不变。
- 空数组、缺失字段、绑定重叠、跨边界合并和超高行产生稳定诊断。
- A4/Letter、横纵向、边距、固定缩放、fit-width、重复标题行列和手工分页通过几何测试。
- Preview 与 Browser Print 引用相同 `PrintPage` 标识、页数和 display list。
- Chrome、Firefox 和 Safari 完成真实打印预览人工验收；自动化测试覆盖 iframe 内容隔离、`afterprint` 和超时清理。
- 编译、展开、重算和分页在无 DOM 环境中可测试。
- 编译后修改工作簿、模板或 print profile，再用旧 `CompiledTemplate` 渲染时稳定返回 `TEMPLATE_SOURCE_STALE`，不产生部分输出。

### 依赖与已决决策

- 依赖 Workbook 2.0、Command/Transaction、Formula & Format Core 和统一 `CellPresentation`。
- MVP 不依赖 PDF 或 XLSX 库。
- 预览使用 SVG 页面；编辑网格继续使用 Canvas。
- 字体缺失默认阻止确定性输出，不静默替换导致重新分页。
- 日期和数字格式遵循 Excel/XLSX 语义，locale、时区和 1900/1904 日期系统显式传入。

---

## TP2. Advanced Template Structure

**Status:** planned
**Delivery:** Phase 2

### 产品目标与场景

覆盖多层明细、横向标签、按客户拆页、多工作表生成和复用片段等复杂业务模板。业务用户仍通过框选区域和属性面板配置，开发者可用 API 批量生成相同模型。

### 范围与非目标

范围包括嵌套循环、横向重复、二维区域重复、每项重复页面、每项复制工作表、条件区域和可复用子模板。支持父作用域、当前项、`$index`、`$first`、`$last`。

非目标包括模板中的任意脚本、跨模板网络加载、宏、业务流程编排和自动持久化。子模板必须在编译输入中显式注册，不能在渲染期从任意 URL 加载。

### UX 与 API

模板面板以树展示结构绑定和包含关系。创建内层绑定时必须先选中父区域；部分交叉区域会被立即拒绝并定位。重复策略提供“纵向”“横向”“区域”“每项一页”“每项一工作表”。子模板选择器只显示宿主注册且 schema 兼容的模板。

```ts
type StructuralBinding =
  | RepeatRowsBinding
  | RepeatColumnsBinding
  | RepeatRangeBinding
  | RepeatPageBinding
  | RepeatSheetBinding
  | ConditionalRangeBinding
  | SubtemplateBinding;

interface AdvancedCompileOptions extends CompileOptions {
  subtemplates: ReadonlyMap<TemplateId, SpreadsheetTemplate>;
  limits: RenderLimits;
}
```

### 数据模型

结构绑定编译为有序 `TemplateRegionNode` 树。每个节点记录源区域、作用域表达式、复制轴、空集合行为、分页策略和子节点。子区域必须完全包含于父区域；兄弟区域可以分离或边界相接，但不得部分交叉。

浮动对象进入重复区域时必须显式声明 `per-item | shared | forbidden`。`per-item` 复制锚点和资源引用；`shared` 保留一个对象并要求对象锚点不依赖被扩展的边界；`forbidden` 在编译期报错。

### 内部模块与数据流

编译器先构建区域包含树，再验证作用域和依赖。展开按外层到内层解析数据；同一层的结构补丁从右下向左上应用，避免前序插入改变未处理源坐标。每次扩展产生结构映射表，统一转换公式 AST、命名范围、表格、合并、验证、条件格式、对象锚点和 print profile。

`RepeatPage` 先生成逻辑文档片段，再向分页器提交强制页边界；`RepeatSheet` 创建稳定且唯一的 sheet ID，并用受限命名规则生成可见名称。

### 错误、性能与安全

- 错误码增加 `PARTIALLY_OVERLAPPING_REGION`、`INVALID_NESTING`、`SUBTEMPLATE_CYCLE`、`DUPLICATE_GENERATED_SHEET_NAME`、`OBJECT_REPEAT_POLICY_REQUIRED` 和 `EXPANSION_LIMIT_EXCEEDED`。
- 编译时检测子模板依赖环和最大嵌套深度。
- 展开前根据集合长度估算输出规模；超限时在分配大对象前终止。
- 作用域对象冻结，父作用域只读；表达式无法修改当前项或根数据。
- 展开过程分批让出主线程，Worker 实现必须保持确定的补丁顺序。

### 迁移与破坏性更新策略

TP1 绑定 schema 使用带 `type` 的判别联合，为高级绑定直接扩展；若 TP1 内部 IR 不满足树结构要求，升级时一次性重编译模板，不承诺序列化 IR 兼容。模板源 schema 通过 `schemaVersion` 迁移，旧编译缓存全部失效。

### 分阶段交付

1. 区域树、嵌套循环和父作用域。
2. 横向与二维区域重复。
3. 每项一页和每项一工作表。
4. 子模板注册、依赖环检测和复用 UI。
5. 浮动对象复制策略、规模估算和 Worker 扩展。

### 验收标准

- 三层嵌套循环按输入顺序产生确定结果，父作用域引用正确。
- 横向和二维扩展后公式、合并、样式、验证和打印范围保持一致。
- 每项一页严格产生一项至少一页；超长项可延续到后续页但不与下一项共页。
- 子模板循环依赖在编译期一次报告完整链路。
- 达到单元格、工作表或页数限制前安全终止，不产生部分 `GeneratedDocument`。
- 浮动对象没有复制策略时无法编译；三种策略均有回归测试。

### 依赖与已决决策

- 依赖 TP1 和 Foundation 的稳定结构命令映射。
- 嵌套区域只允许完整包含，不支持部分交叉语义。
- 展开顺序是外层到内层、同层右下到左上，这是可测试的产品语义。
- 子模板必须由宿主显式注册，运行期不执行远程发现。

---

## TP3. Resource Pipeline

**Status:** planned
**Delivery:** Phase 2

### 产品目标与场景

让模板安全地使用企业 Logo、商品图片、签名、二维码和自定义字体，同时保证预览、打印、PDF 和图片输出引用同一份已解析资源。

### 范围与非目标

范围包括 Data URL、Blob、应用资源 ID、受控网络 URL、图片解码、字体加载、二维码生成、内容哈希去重、缓存、取消和配额。非目标包括通用网络客户端、凭证管理、任意 SVG 执行、视频/音频和永久云存储。

### UX 与 API

模板面板允许为图片绑定选择静态资源或数据表达式，并显示 MIME、像素尺寸、字节数和解析状态。预览在资源失败处显示诊断占位，但 error 级资源失败阻止正式输出。

```ts
interface ResourceResolver {
  readonly id: string;
  supports(ref: ResourceRef): boolean;
  resolve(
    ref: ResourceRef,
    context: ResolveContext,
  ): Promise<ResolvedResource>;
}

interface ResolveContext {
  signal: AbortSignal;
  limits: ResourceLimits;
  requestedPurpose: 'preview' | 'print' | 'pdf' | 'xlsx' | 'image';
}
```

### 数据模型

`ResourceRef` 只保存资源类型、解析器 ID、opaque key 和声明的期望 MIME，不保存访问令牌。`ResolvedResource` 保存内容哈希、规范 MIME、尺寸、字节、解码后的只读表示和释放句柄。`ResolvedResourceStore` 按内容哈希去重，并记录逻辑引用到内容的映射。

### 内部模块与数据流

模板数据解析生成资源引用 → resolver registry 按声明顺序匹配 → 并发调度器执行解析 → MIME sniff 与限制校验 → 图片/字体/SVG 专用验证器 → 内容哈希和去重 → 解码 → 冻结后的资源存储 → layout/paint/output。

二维码不是远程资源：核心二维码模块接收字符串和样式，生成受限矢量 path，作为可缓存资源进入同一管线。

### 错误、性能与安全

- 错误码包括 `RESOURCE_RESOLVER_NOT_FOUND`、`RESOURCE_FETCH_FAILED`、`RESOURCE_MIME_MISMATCH`、`RESOURCE_TOO_LARGE`、`RESOURCE_DECODE_FAILED`、`RESOURCE_TIMEOUT`、`UNSAFE_SVG` 和 `FONT_PARSE_FAILED`。
- 网络 resolver 默认不注册；宿主显式注册并自行处理认证。
- resolver 只收到当前资源所需引用和受限 context，不收到整份模板数据。
- SVG 移除脚本、事件属性、外部引用、foreignObject 和不允许的 URL scheme。
- 同时限制单资源、总资源、像素数、SVG 节点数、字体数、并发数和解析时间。
- 缓存有字节预算和 LRU 淘汰；会话结束释放 Object URL、ImageBitmap 和字体句柄。

### 迁移与破坏性更新策略

图片和字体不再以任意 URL 字符串直接进入 renderer。旧数据中的 URL 经迁移器转换为指定 resolver 的 `ResourceRef`；没有宿主 resolver 时产生明确诊断。旧的 Canvas 图片加载分支被删除。

### 分阶段交付

1. registry、Data URL/Blob resolver、哈希、配额和生命周期。
2. 图片解码、尺寸策略和 SVG 清理。
3. 字体解析、加载、子集信息和确定性度量衔接。
4. 宿主资源 ID/网络 resolver 接口。
5. 二维码矢量资源和跨输出一致性测试。

### 验收标准

- 同内容不同引用只解码一次，所有输出得到相同内容哈希。
- 取消渲染会停止未完成请求并释放已创建的临时资源。
- 超限图片、伪造 MIME 和含脚本 SVG 均被拒绝。
- 网络 resolver 未注册时不会隐式发起网络请求。
- CJK 字体加载完成前不开始分页；缺失字体不会静默替换。
- 资源失败不会污染编译缓存或其他并发渲染会话。

### 依赖与已决决策

- 依赖 TP1 的渲染会话和 `AbortSignal`，被 PDF/XLSX/Image 适配器依赖。
- 资源凭证始终属于宿主，文档只保存 opaque 引用。
- SVG 采用白名单清理后转为内部矢量节点，不直接插入任意外部 DOM。

---

## TP4. PDF Adapter

**Status:** planned
**Delivery:** Phase 2

### 产品目标与场景

在浏览器或受支持的 Worker/Node 环境中，从与预览相同的页面几何生成可下载、可归档的 PDF `Blob`，满足中文业务文档、矢量文本和可搜索内容需求。

### 范围与非目标

范围包括全部/指定页、文档 metadata、矢量文本和边框、图片、链接、书签、字体嵌入和 CJK 子集化。首期 `tagged` 固定为 `false`，不承诺 PDF/UA、数字签名、加密、表单字段、打印机色彩管理或服务端任务队列。

### UX 与 API

预览工具栏提供“导出 PDF”，显示生成进度、取消入口和输出诊断。文件名来自显式 options 或模板 metadata，不从单元格内容隐式推断。

```ts
interface PdfOutputOptions {
  pages: 'all' | readonly number[];
  metadata?: PdfMetadata;
  tagged: false;
  signal?: AbortSignal;
}

interface PdfAdapter extends OutputAdapter<Blob> {
  render(document: GeneratedDocument, options: PdfOutputOptions): Promise<Blob>;
}
```

### 数据模型

PDF adapter 只读取 `PrintDocument` 的固定页面尺寸、`PrintDisplayList`、字体映射、图片资源和链接注释。坐标以设备无关长度保存，adapter 负责转换为 PDF point。字体资源包含字体文件、face 标识、使用字形集合和嵌入许可结果。

### 内部模块与数据流

页选择验证 → 收集使用资源与字形 → 字体子集化 → display list 到 PDF operator → 写入图片/链接/书签 → metadata → finalize Blob。所有页面按 `PrintDocument.pages` 顺序输出；adapter 不重新排版或重新测量文本。

### 错误、性能与安全

- 错误码包括 `PDF_UNSUPPORTED_DRAW_COMMAND`、`PDF_FONT_EMBEDDING_FORBIDDEN`、`PDF_FONT_SUBSET_FAILED`、`PDF_PAGE_SELECTION_INVALID` 和 `PDF_OUTPUT_LIMIT_EXCEEDED`。
- 字体不可嵌入或缺失时默认失败；不使用可能改变换行的回退字体。
- 对页数、图片总字节、输出 Blob 大小和生成时间设限。
- URL 链接只允许配置的 scheme；metadata 做长度和控制字符清理。
- 大文档采用流式 writer 或分段缓冲，避免复制完整文件多次。

### 迁移与破坏性更新策略

PDF 是新适配器，不复用浏览器“打印为 PDF”作为 SDK 能力。若具体实现依赖无法满足 CJK、字体许可、矢量或体积要求，则替换依赖而不改变 `PdfAdapter` 契约。

### 分阶段交付

1. 依赖评估：字体、CJK、子集化、浏览器体积、许可证、Worker 和矢量能力必须全部达标。
2. 基础页面、文本、边框、填充和图片。
3. 字体注册、CJK 子集化、链接和 metadata。
4. 书签、进度、取消和大文档内存优化。
5. 与 Preview 的几何黄金测试和真实 PDF 查看器验证。

### 验收标准

- PDF 与同一 `GeneratedDocument` 的 Preview 页数、页面尺寸、单元格边界和换行一致。
- 文本可选择和搜索；边框和形状为矢量。
- 中文字体仅嵌入实际使用字形，且许可证检查通过。
- 取消或失败不返回部分 Blob，不影响随后再次输出。
- Chrome、Firefox、Safari 及一个 Worker 环境生成结果通过解析器结构检查和人工视觉验收。

### 依赖与已决决策

- 依赖 TP1、TP3 和稳定 `PrintDisplayList`。
- PDF adapter 不拥有布局逻辑。
- 具体 PDF 库在实施前通过独立、可复现的依赖评估确定，选择标准已经固定，不预设库名。

---

## TP5. XLSX Template Adapter

**Status:** planned
**Delivery:** Phase 2

### 产品目标与场景

将模板绑定后的结果导出为仍可在 Excel 中继续编辑、计算和打印的 XLSX，而不是静态图片。目标用户包括需要归档源表、交给财务复核或二次编辑的业务系统。

### 范围与非目标

范围包括值、公式、缓存结果、数字格式、样式、合并、验证、条件格式、行高列宽、隐藏状态、打印区域、重复标题、分页、边距、缩放、页眉页脚、图片、工作表顺序和可见性。兼容基准为 Excel/XLSX 语义。

非目标包括 VBA/宏、任意未知 OOXML 部件无损 round-trip、外部数据连接、完整 Excel 特性兼容和从 SVG/Canvas 反推工作簿。

### UX 与 API

预览工具栏提供“导出 XLSX”。输出前展示降级诊断；error 阻止导出，warning 允许用户在已知差异下导出。

```ts
interface XlsxOutputOptions {
  formulaMode: 'formula-and-cached-value' | 'values-only';
  compatibility: 'excel';
  signal?: AbortSignal;
}

interface XlsxAdapter extends OutputAdapter<Blob> {
  render(document: GeneratedDocument, options: XlsxOutputOptions): Promise<Blob>;
}
```

### 数据模型

adapter 消费 `RenderedWorkbook`，其单元格保留 typed input、公式 AST/源文本、计算结果、格式、样式 ID 和关系稳定 ID。打印 profile 映射到 OOXML 的 print area、print titles、page setup、page margins、row/column breaks 和 header/footer。图片从 `ResolvedResourceStore` 建立 media 与 relationship。

### 内部模块与数据流

语义支持检查 → workbook/sheet/style/shared-string 映射 → 公式和缓存结果写入 → 合并/验证/条件格式 → print settings → media/relationships → package manifest → ZIP 输出 → 结构校验。序列化器按稳定顺序生成部件，便于确定性测试。

### 错误、性能与安全

- 错误码包括 `XLSX_UNSUPPORTED_FEATURE`、`XLSX_INVALID_SHEET_NAME`、`XLSX_FORMULA_SERIALIZATION_FAILED`、`XLSX_STYLE_LIMIT_EXCEEDED`、`XLSX_PACKAGE_LIMIT_EXCEEDED` 和 `XLSX_RESOURCE_UNSUPPORTED`。
- 对工作表数、单元格数、样式数、图片数、共享字符串和压缩包大小设限。
- 公式以受支持 AST 序列化，禁止注入任意 OOXML 或外部关系。
- 文件名、sheet 名、relationship target 和 XML 文本严格转义。
- 公式以 `=` 开头是工作簿语义；来自纯文本数据的 `=` 不得被自动升级为公式。

### 迁移与破坏性更新策略

XLSX adapter 只保证本项目明确支持的语义。导入的未知 OOXML 扩展不会被宣称无损保留。随着支持面扩展，能力 manifest 版本递增；出现不可表达的功能必须诊断，不能静默丢弃。

### 分阶段交付

1. 依赖评估与 OOXML fixture 基线。
2. 值、公式、格式、样式、合并、尺寸和工作表结构。
3. 验证、条件格式、打印设置和页眉页脚。
4. 图片、关系、缓存结果和大文件优化。
5. Excel Desktop、Excel for web 和 LibreOffice 互操作矩阵。

### 验收标准

- 支持的值、公式、格式、样式、合并、验证和条件格式导出后语义一致。
- Excel Desktop、Excel for web 和 LibreOffice 均能无修复提示打开文件。
- 打印区域、重复标题、页边距、方向、缩放和分页在 Excel 中可见且正确。
- `formula-and-cached-value` 同时保留公式和当前结果；`values-only` 不包含公式。
- 不支持能力产生可定位诊断，导出不会静默丢失已声明支持的数据。
- 相同 `GeneratedDocument` 和 options 产生结构等价、部件顺序稳定的包。

### 依赖与已决决策

- 依赖 Workbook 2.0、Formula & Format Core、TP1、TP3。
- XLSX 使用 `RenderedWorkbook`，不消费页面截图。
- Excel 是公式、日期序列、数字格式和打印设置的主要兼容基准；不承诺完整 Excel 兼容。

---

## TP6. Image Adapter

**Status:** planned
**Delivery:** Phase 2

### 产品目标与场景

将指定页面输出为 SVG 或 PNG，用于消息卡片、预览缩略图、归档图片和不支持 PDF 的下游系统。

### 范围与非目标

范围包括单页 SVG/PNG、多页 `Blob[]`、PNG DPI、背景色、透明背景和像素限制。非目标包括视频、动画、图像编辑、OCR 和将多页隐式打包为 ZIP；ZIP 由独立组合适配器完成。

### UX 与 API

用户选择页码、格式、PNG DPI 和背景。多页导出明确显示将生成的文件数量。

```ts
interface ImageOutputOptions {
  format: 'svg' | 'png';
  pages: readonly number[];
  dpi?: number;
  background?: string | 'transparent';
  signal?: AbortSignal;
}

interface ImageAdapter extends OutputAdapter<readonly Blob[]> {
  render(document: GeneratedDocument, options: ImageOutputOptions): Promise<readonly Blob[]>;
}
```

### 数据模型

adapter 读取固定 `PrintPage`、display list 和已解析资源。SVG 输出包含规范 viewBox；字体采用许可允许的内嵌子集，否则输出失败。PNG 由同一矢量 display list 按指定 DPI 栅格化。

### 内部模块与数据流

页选择 → display list 转 SVG DOM/字符串 → 资源和字体内嵌 → SVG Blob；PNG 分支在 SVG/矢量场景上创建受尺寸限制的离屏画布 → 栅格化 → Blob → 立即释放画布资源。

### 错误、性能与安全

- 错误码包括 `IMAGE_PAGE_SELECTION_INVALID`、`IMAGE_PIXEL_LIMIT_EXCEEDED`、`IMAGE_FONT_EMBEDDING_FAILED` 和 `IMAGE_ENCODING_FAILED`。
- 宽 × 高 × 页数 × DPI 转换后的总像素必须在限制内。
- SVG 不包含脚本、外部 URL 或未清理 foreignObject。
- 每页完成后释放中间缓冲；取消时不返回部分数组。

### 迁移与破坏性更新策略

这是新适配器。现有 Canvas 截图能力不作为实现基础，避免受 viewport、devicePixelRatio 和浏览器字体加载时机影响。

### 分阶段交付

1. 单页 SVG 和资源内嵌。
2. 单页 PNG、DPI 与背景。
3. 多页、进度、取消和内存上限。
4. 与 Preview/PDF 的几何黄金测试。

### 验收标准

- SVG viewBox 与 `PrintPage` 尺寸一致，文本与边框位置和 Preview 一致。
- PNG 在 96、150、300 DPI 下尺寸计算准确，超过像素限制时在分配前失败。
- 多页严格保持请求顺序，任何一页失败均不返回部分结果。
- 输出 SVG 不含网络依赖或可执行内容。

### 依赖与已决决策

- 依赖 TP1、TP3 和稳定 display list。
- 多页默认返回 `Blob[]`，不隐式引入 ZIP 依赖。
- SVG 是主要矢量中间表示，PNG 是确定性栅格化结果。

---

## 2. 能力域交付门禁

每个阶段进入下一阶段前必须满足：

1. 公开 schema 和诊断码有类型测试与序列化 fixture；
2. 核心编译、展开、重算和分页无 DOM 测试通过；
3. 浏览器能力完成 Chrome、Firefox、Safari 验证；
4. 输出 adapter 对相同 `GeneratedDocument` 的页数和几何一致性通过；
5. 取消、超限、资源失败和清理路径有回归测试；
6. 迁移文档明确列出删除的旧 API 与一次性转换方式；
7. 未安装任何宿主 adapter 时，模板编辑、样例预览和本地输出仍可独立工作。
