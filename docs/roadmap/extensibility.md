# Extensibility Mini-RFCs

- 状态：`planned`
- 能力域：SDK Ecosystem
- 产品边界：本项目提供可嵌入的电子表格组件与 TypeScript SDK，不提供插件市场、账号体系、插件托管、远程代码分发或商业授权服务。
- 设计基线：允许破坏尚未发布的旧 API；扩展协议稳定后再承诺兼容窗口。

## 共同技术定义

扩展体系只暴露版本化协议、不可变快照和受限能力上下文。插件不得持有内部 `WorkbookController`、React 组件树、Canvas 上下文或可变文档引用，也不得绕过 command/transaction 修改文档。

```ts
type ApiVersion = `${number}.${number}`;

interface ExtensionManifest {
  id: string;
  apiVersion: ApiVersion;
  execution: 'trusted-main' | 'isolated-worker';
  capabilities: readonly ExtensionCapability[];
  environments: readonly ExtensionEnvironment[];
}

type ExtensionEnvironment = 'browser' | 'worker' | 'node';

type ExtensionCapability =
  | 'document:read'
  | 'command:propose'
  | 'resource:resolve'
  | 'network:host-mediated'
  | 'output:write';

interface ExtensionRuntimeContext {
  readonly signal: AbortSignal;
  readonly limits: ResourceLimits;
  readonly diagnostics: DiagnosticSink;
}
```

版本规则如下：

- `apiVersion` 使用主版本与次版本；主版本不一致时拒绝加载。
- 同主版本下，运行时只向插件提供其声明版本已有的字段。
- 未声明 capability 的调用在运行时返回 `CAPABILITY_DENIED`，不得静默放行。
- 所有异步调用接收取消信号，并受时间、并发、输出大小和内存预算约束。
- 扩展失败只影响对应单元格、模板节点或输出任务，不能留下部分提交的文档状态。
- `trusted-main` 扩展与宿主应用运行在同一 JavaScript realm，capability context 只约束 SDK 暴露面，不是恶意代码安全沙箱；只有使用 structured clone 协议的 `isolated-worker` 纯计算扩展可视为隔离执行。

---

## E1. Cell Extension SDK

### 状态

`planned`

### 产品目标与用户场景

让宿主应用能够定义“人员、状态、评分、附件、地点”等业务单元格，同时保持编辑、复制、序列化、公式显示、无障碍和打印行为一致。

典型场景：

- CRM 用人员选择器写入稳定用户 ID，屏幕显示姓名与头像，打印显示姓名。
- 项目表用状态单元格提供枚举编辑器和颜色标识。
- 质检表用评分单元格保存结构化数值并输出可读文本。
- 宿主为既有业务值注册自定义编辑器，但仍通过标准 transaction 完成提交和撤销。

### 范围与非目标

范围：

- 类型 schema、解析、校验、格式化、序列化与反序列化。
- 屏幕 renderer、受控 editor、打印 renderer 和无障碍描述。
- 剪贴板的纯文本与结构化 MIME 表示。
- 未安装插件时的只读降级显示和稳定诊断。

非目标：

- 不提供远程插件下载或插件商店。
- 不允许插件直接绘制到共享 Canvas，也不允许 editor 直接修改工作簿。
- 不承诺自定义值自动参与任意公式；公式转换由插件显式声明。
- 不允许序列化 React 元素、函数、DOM 节点或宿主对象。

### 产品交互与公开 API

宿主在创建组件前注册单元格类型。用户进入单元格时，SDK 创建一次受控编辑会话；确认提交一个 `SetCellValueCommand`，取消不产生 transaction。插件不可用时，单元格显示已序列化值的安全文本摘要，并在检查面板显示 `CELL_PLUGIN_UNAVAILABLE`。

```ts
interface CellTypePlugin<Value, Serialized> {
  readonly manifest: ExtensionManifest;
  readonly type: string;
  readonly schemaVersion: number;
  readonly schema: ValueSchema<Value>;

  parse(input: unknown, context: CellParseContext): ParseResult<Value>;
  format(value: Value, context: CellFormatContext): string;
  serialize(value: Value): Serialized;
  deserialize(value: Serialized, storedVersion: number): DeserializeResult<Value>;
  migrate?(value: unknown, fromVersion: number): DeserializeResult<Serialized>;

  renderer?: CellRenderer<Value>;
  editor?: CellEditorFactory<Value>;
  print?: CellPrintRenderer<Value>;
  accessibility?: CellAccessibilityProvider<Value>;
  clipboard?: CellClipboardCodec<Value>;
  formula?: CellFormulaCoercion<Value>;
}

interface CellEditorSession<Value> {
  readonly initialValue: Value;
  readonly signal: AbortSignal;
  commit(value: Value): void;
  cancel(): void;
}

interface CellTypeRegistry {
  register<Value, Serialized>(plugin: CellTypePlugin<Value, Serialized>): Unregister;
  get(type: string): CellTypePlugin<unknown, unknown> | undefined;
}
```

### 数据模型

```ts
interface CustomCellInput {
  type: 'custom';
  cellType: string;
  schemaVersion: number;
  value: JsonValue;
}

interface CellPresentationExtension {
  formattedText: string;
  accessibilityLabel: string;
  paint: readonly CellPaintPrimitive[];
  print: readonly DrawCommand[];
}
```

持久化只保存 `cellType`、`schemaVersion` 与 JSON 可序列化值。组件载入时先做 schema 迁移，再做验证；迁移结果只在用户保存或显式执行迁移命令后写回文档。

### 内部模块与数据流

```text
Serialized custom cell
→ registry lookup
→ schema migration
→ deserialize + validate
→ CellPresentation
→ screen / accessibility / print

Editor input
→ plugin parse
→ schema validate
→ SetCellValueCommand
→ transaction commit
→ recalculation + presentation invalidation
```

建议实现边界：

- `cell-types/registry`：注册、版本匹配与重复 ID 检查。
- `cell-types/runtime`：调用预算、取消、异常隔离和诊断转换。
- `cell-types/presentation`：把插件输出归一为受控绘制原语。
- `cell-types/editor-session`：管理 editor 生命周期和唯一提交入口。
- `cell-types/serialization`：schema 版本、迁移和降级表示。

### 错误、性能与安全

稳定诊断码：

- `CELL_PLUGIN_UNAVAILABLE`
- `CELL_PLUGIN_VERSION_UNSUPPORTED`
- `CELL_VALUE_INVALID`
- `CELL_VALUE_MIGRATION_FAILED`
- `CELL_RENDER_FAILED`
- `CELL_EDITOR_FAILED`
- `CELL_PRINT_FALLBACK`
- `CAPABILITY_DENIED`

约束：

- `trusted-main` renderer 必须为同步纯函数；运行时记录耗时并在连续超出 2 ms 观测预算时，于当前调用返回后禁用该插件并降级为格式化文本。同步 JavaScript 无法被安全抢占，因此该预算不是硬超时。
- 不受信任的 renderer 必须作为 `isolated-worker` 扩展预先生成可 structured-clone 的受控绘制原语；它不能提供 React editor。需要 React editor 或主线程事件处理的插件必须声明 `trusted-main`。
- editor 只能访问当前值、locale、只读查询接口与提交/取消回调。
- `format`、`serialize`、`deserialize` 不得访问网络。
- `print` 缺失时输出 `format` 的文本结果并产生 warning；不得输出空白。
- 单元格扩展值默认最大 64 KiB；更大资源使用 `ResourceRef`。
- 插件异常被捕获并转换为诊断，不能打断整张表的渲染或打印。

### 破坏性更新策略

- Workbook 2.0 直接引入 `CustomCellInput`，不保留把自定义值塞入旧 `text` 字段的兼容分支。
- 现有 renderer/editor 扩展点统一迁移到 `CellTypePlugin`；旧回调在新主干删除。
- 在扩展 API 首个稳定主版本前，可依据实现验证调整类型签名；每次变更同时更新 schema fixture、类型测试和迁移说明。
- `schemaVersion` 属于单元格类型自身数据版本，与 SDK `apiVersion` 分离，禁止混用。

### 交付阶段

1. **E1.1 协议与注册表**：完成 manifest、schema、注册冲突、序列化与未知插件降级。
2. **E1.2 展示与编辑**：接入 `CellPresentation`、受控 editor session、键盘和无障碍语义。
3. **E1.3 打印与剪贴板**：接入 `PrintDisplayList`，实现文本/结构化剪贴板 codec。
4. **E1.4 加固**：加入预算、取消、异常隔离、迁移 fixture 和示例插件。

### 验收标准

- 注册的自定义单元格可编辑、撤销、重做、复制、序列化并 round-trip。
- 未注册插件的文档可打开，值不丢失，屏幕与打印均有安全文本降级。
- 插件 editor 取消时不产生 change event，提交时只产生一个 transaction。
- 插入/删除行列后自定义单元格与其引用位置正确移动。
- 同一值在屏幕、无障碍层和打印中的文本语义一致。
- `isolated-worker` 插件无法取得 DOM/Canvas/controller，其任务可取消且异常不会破坏其他单元格；`trusted-main` 插件只保证公开 API 最小化和异常归一，不宣称隔离恶意宿主代码。
- 类型测试证明插件只能使用公开上下文；资源账本测试证明卸载后无监听器与对象泄漏。

### 依赖与已决决策

依赖：Workbook 2.0、Command/Transaction、`CellPresentation`、统一 Diagnostic、Print Display List、Resource Store。

已决决策：

- 自定义单元格采用结构化值，不以格式化字符串作为数据真相。
- editor 是受控会话，只有 command 能修改文档。
- print renderer 可选，但格式化文本降级为强制行为。
- 插件不直接接触 React 树或 Canvas。
- 公式参与能力显式注册，不做隐式 JavaScript 强制转换。

---

## E2. Template Module SDK

### 状态

`planned`

### 产品目标与用户场景

允许开发者在不修改核心编译器的前提下增加模板节点能力，例如二维码、条码、业务签章、特殊条件块和行业格式化节点，并确保这些能力在预览、浏览器打印、PDF 与图片输出中遵循同一 IR 与诊断模型。

### 范围与非目标

范围：

- 模板节点识别、IR 转换、数据解析、布局、绘制与诊断增强。
- 模块优先级、节点所有权、API 版本和能力声明。
- 每阶段不可变输入输出、取消、资源限额和 dispose 生命周期。
- 模块产生的资源统一走 Resource Pipeline。

非目标：

- 不提供任意 `beforeEverything`/`afterEverything` 全局钩子。
- 不允许执行模板中的任意 JavaScript。
- 不提供 Raw DOM、Raw Canvas 或未经清理的 Raw SVG 逃生口。
- 不允许模块直接修改 `SpreadsheetTemplate`、`RenderedWorkbook` 或 `PrintDocument`。

### 产品交互与公开 API

开发者注册模块后，模板设计器在插入菜单展示模块声明的节点类型。业务用户配置模块定义的 schema 表单；设计器在保存前运行编译诊断。模块缺失或版本不兼容时，模板可只读打开，但预览和输出被阻止，并定位到具体节点。

```ts
interface TemplateModule<NodeConfig = unknown> {
  readonly manifest: ExtensionManifest;
  readonly name: string;
  readonly priority: number;
  readonly nodeTypes: readonly TemplateNodeTypeDefinition<NodeConfig>[];

  recognize?(context: RecognizeContext): readonly TemplateNode[];
  transformIR?(ir: TemplateIR, context: TransformContext): TemplateIR;
  resolve?(
    nodes: readonly TemplateNode[],
    context: TemplateResolveContext,
  ): Promise<readonly ResolvedTemplateNode[]>;
  layout?(node: ResolvedTemplateNode, context: TemplateLayoutContext): LayoutNode;
  paint?(node: LayoutNode, context: TemplatePaintContext): readonly DrawCommand[];
  dispose?(): void | Promise<void>;
}

interface TemplateNodeTypeDefinition<Config> {
  type: string;
  configSchema: ValueSchema<Config>;
  editor: DeclarativePropertyEditor;
  outputSupport: readonly OutputKind[];
}

interface TemplateModuleRegistry {
  register(module: TemplateModule): Unregister;
  validateGraph(): readonly Diagnostic[];
}
```

### 数据模型

```ts
interface ExtensionTemplateNode {
  id: TemplateNodeId;
  type: `extension:${string}/${string}`;
  module: string;
  moduleApiVersion: ApiVersion;
  configVersion: number;
  config: unknown;
  sourceRange?: CellRange;
}

interface LayoutNode {
  id: string;
  bounds: Rect;
  breakBehavior: BreakBehavior;
  accessibilityText: string;
  payload: Readonly<unknown>;
}
```

模块配置必须 JSON 可序列化，并由节点 schema 验证。模块输出的绘制结果只能是核心定义的 `DrawCommand`，包括文本、路径、图片引用、裁切和链接；不接受可执行内容。

### 内部模块与数据流

```text
Template metadata
→ core parse
→ module recognize
→ ownership/conflict validation
→ immutable TemplateIR
→ ordered transformIR
→ resolve data/resources
→ layout
→ paint to DrawCommand[]
→ PrintDocument
→ output adapters
```

阶段顺序固定为 `recognize → transform → resolve → layout → paint`。同一模块内节点按文档顺序稳定执行；不同模块按 `priority` 升序、`name` 字典序决胜。两个模块认领同一源节点时产生 error，不按优先级覆盖。

建议实现边界：

- `template-modules/registry`：注册、版本、节点类型和能力图。
- `template-modules/compiler-host`：阶段调度、不可变检查和冲突检测。
- `template-modules/runtime`：取消、预算、异常隔离和 dispose。
- `template-modules/draw-command-validator`：绘制命令、资源引用和边界检查。
- `template-modules/designer-schema`：声明式属性面板协议。

### 错误、性能与安全

稳定诊断码：

- `TEMPLATE_MODULE_UNAVAILABLE`
- `TEMPLATE_MODULE_VERSION_UNSUPPORTED`
- `TEMPLATE_NODE_CONFIG_INVALID`
- `TEMPLATE_NODE_OWNERSHIP_CONFLICT`
- `TEMPLATE_MODULE_PHASE_FAILED`
- `TEMPLATE_MODULE_OUTPUT_UNSUPPORTED`
- `TEMPLATE_MODULE_LIMIT_EXCEEDED`
- `TEMPLATE_DRAW_COMMAND_INVALID`

约束：

- 每次编译最多生成 100,000 个扩展节点；宿主可调低，不能调高于核心硬上限。
- 单模块 resolve 默认并发 4，默认超时 30 秒，继承渲染任务的 `AbortSignal`。
- 模块只能通过受限 resolver 请求资源；网络默认关闭。
- `transformIR` 必须保持 ID 唯一、引用有效和源位置映射；运行时在每轮转换后校验。
- 输出适配器不加载或执行模板模块；所有模块逻辑必须在 `PrintDocument` 生成前结束。
- dispose 失败记录 warning，不阻断其他模块释放。

### 破坏性更新策略

- 模板编译器直接采用阶段式模块协议，不保留早期字符串扫描或全局 hook 兼容层。
- IR 在稳定前属于内部协议；仅 `TemplateModule` 暴露的节点视图受 `apiVersion` 管理。
- 主版本升级可删除阶段或更改节点契约，但必须提供模块编译期失败信息和迁移文档，禁止静默跳过节点。
- 节点 `configVersion` 由模块负责迁移，SDK 版本由核心负责协商。

### 交付阶段

1. **E2.1 编译宿主**：注册表、阶段调度、节点所有权和稳定排序。
2. **E2.2 解析与资源**：受限表达式上下文、Resource Pipeline、取消与限额。
3. **E2.3 布局与绘制**：LayoutNode、DrawCommand 校验及预览/打印一致性。
4. **E2.4 设计器协议**：声明式属性面板、节点插入、缺失模块只读体验。
5. **E2.5 参考模块**：以二维码模块覆盖配置、资源、分页、PDF 和错误路径。

### 验收标准

- 模块在相同模板、数据、locale、时区和字体度量下产生确定相同的 IR 与绘制命令。
- 两个模块认领同一节点时编译失败，并同时报告全部冲突位置。
- 缺失或版本不兼容模块不会丢失配置，且阻止不完整输出。
- 模块任务可取消；达到节点、时间或资源上限时返回稳定诊断。
- 模块异常不会修改输入 IR，也不会污染其他输出任务。
- 参考二维码模块在 Preview、Browser Print、PDF 和 PNG 中几何一致。
- 安全测试证明模块不能注入脚本、外部 SVG 引用、DOM 或未声明网络请求。

### 依赖与已决决策

依赖：Template Compiler、不可变 Template IR、受限表达式引擎、Resource Pipeline、Layout Engine、Print Display List、Diagnostic。

已决决策：

- 生命周期采用有限阶段，不提供无边界全局 hook。
- 模块返回新 IR/节点，不修改输入。
- 模块输出核心绘制命令，不输出 DOM/Canvas。
- 核心决定冲突与排序语义，插件不能相互覆盖。
- 模块能力在模板设计器与开发者 API 使用同一配置模型。

---

## E3. Adapter Registry

### 状态

`planned`

### 产品目标与用户场景

为文件导入导出、资源解析、文档输出、图表渲染、公式函数、求解器、持久化和协作建立统一的发现、版本协商与生命周期机制，使宿主能够只安装所需能力，并让核心在缺少可选 adapter 时保持可用。

### 范围与非目标

范围：

- adapter manifest、类别、能力、环境、版本和唯一 ID。
- 显式注册、选择、覆盖规则、会话作用域、释放和诊断。
- 按 capability 提供最小上下文。
- 支持 browser、worker、node 三种运行环境的可用性判断。

非目标：

- 不负责依赖注入容器、远程模块加载或包管理。
- 不自动选择“看起来最合适”的 adapter；有歧义时要求调用方指定 ID。
- 不把所有 adapter 强制打进核心 bundle。
- 不用 registry 绕开浏览器权限、宿主授权或服务端鉴权。

### 产品交互与公开 API

```ts
type AdapterKind =
  | 'workbook-reader'
  | 'workbook-writer'
  | 'resource-resolver'
  | 'output'
  | 'chart-renderer'
  | 'formula-function-provider'
  | 'solver'
  | 'persistence'
  | 'collaboration'
  | 'permission'
  | 'comments'
  | 'version-history'
  | 'ai-command';

interface AdapterByKind {
  'workbook-reader': WorkbookReader;
  'workbook-writer': WorkbookWriter;
  'resource-resolver': ResourceResolver;
  output: OutputAdapter<unknown>;
  'chart-renderer': ChartRendererAdapter;
  'formula-function-provider': FormulaFunctionProviderAdapter;
  solver: SolverAdapter;
  persistence: PersistenceAdapter;
  collaboration: CollaborationAdapter;
  permission: PermissionAdapter;
  comments: CommentAdapter;
  'version-history': VersionHistoryAdapter;
  'ai-command': AICommandAdapter;
}

interface AdapterManifest extends ExtensionManifest {
  kind: AdapterKind;
  priority: number;
  formats?: readonly string[];
}

interface Adapter {
  readonly manifest: AdapterManifest;
  initialize?(context: AdapterInitializationContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

interface AdapterRegistry {
  register(adapter: Adapter): Unregister;
  list(query: AdapterQuery): readonly AdapterManifest[];
  resolve<K extends AdapterKind>(
    kind: K,
    query: AdapterResolutionQuery,
  ): AdapterByKind[K];
  createScope(options: AdapterScopeOptions): AdapterScope;
  dispose(): Promise<void>;
}
```

组件设置页可展示已注册能力与不可用原因；这是调试与集成信息，不是面向终端用户的插件市场。输出、导入和求解等显式操作在存在多个匹配项时使用宿主配置的默认 ID，未配置则返回选择错误。

### 数据模型

```ts
interface AdapterResolutionQuery {
  kind: AdapterKind;
  id?: string;
  capability?: string;
  format?: string;
  environment: ExtensionEnvironment;
}

interface AdapterScopeOptions {
  documentId?: string;
  signal: AbortSignal;
  limits: ResourceLimits;
  permissions: CapabilityGrant;
}

interface AdapterResolution {
  manifest: AdapterManifest;
  reason: 'explicit-id' | 'single-match' | 'configured-default';
}
```

注册表自身不序列化 adapter 实例。文档只保存需要长期引用的 adapter ID 与配置 schema；凭证、连接实例和宿主对象必须留在宿主运行时。

### 内部模块与数据流

```text
Host registration
→ manifest validation
→ duplicate/version/environment checks
→ initialize
→ immutable registry snapshot

Operation request
→ query
→ capability + permission filter
→ exact resolution
→ scoped context
→ adapter invocation
→ normalized result/diagnostic
→ scope dispose
```

选择规则：显式 ID 优先；否则使用宿主配置默认；否则仅有一个匹配项时选择；多个匹配项产生 `ADAPTER_AMBIGUOUS`。`priority` 只决定列表顺序和 resolver 链顺序，不替代显式选择。

建议实现边界：

- `adapters/manifest`：schema 和 API 版本协商。
- `adapters/registry`：注册、查询、快照和默认项。
- `adapters/scope`：权限、取消、资源预算和 dispose。
- `adapters/invoke`：异常归一、遥测钩子和结果校验。
- 各 adapter kind 单独定义协议，通用注册表不包含业务方法。

### 错误、性能与安全

稳定诊断码：

- `ADAPTER_MANIFEST_INVALID`
- `ADAPTER_DUPLICATE_ID`
- `ADAPTER_VERSION_UNSUPPORTED`
- `ADAPTER_ENVIRONMENT_UNSUPPORTED`
- `ADAPTER_NOT_FOUND`
- `ADAPTER_AMBIGUOUS`
- `ADAPTER_INITIALIZATION_FAILED`
- `ADAPTER_INVOCATION_FAILED`
- `ADAPTER_DISPOSE_FAILED`
- `CAPABILITY_DENIED`

约束：

- manifest 在注册时完整校验，失败实例不可见。
- 初始化成功后才发布新的 registry snapshot；失败不影响已有注册项。
- 每个文档/输出任务创建独立 scope，凭证与取消信号不跨 scope 复用。
- registry 不记录 token、cookie、连接字符串或用户数据。
- adapter 返回值必须通过对应 kind 的 schema 校验。
- dispose 按初始化逆序执行；所有释放均尝试完成并聚合 warning。

### 破坏性更新策略

- 各类零散注册入口统一删除，迁移到单一 `AdapterRegistry`；不维持双注册表。
- adapter ID 作为宿主配置契约；重命名属于破坏性更新，必须提供配置迁移说明。
- kind 协议各自发布 `apiVersion`；通用 manifest 不保证错误方法签名兼容。
- 在首个稳定版本前允许调整选择规则，但每次变更必须更新歧义、默认项和环境矩阵测试。

### 交付阶段

1. **E3.1 Public Registry SDK**：在 Foundation 的最小 registry kernel 上公开 manifest、注册原子性、类型安全查询、版本与环境校验。
2. **E3.2 Scope Runtime**：capability grant、预算、取消、异常归一和释放。
3. **E3.3 Adapter Kinds**：先接入 resource/output/reader/writer，再接入 solver/persistence/collaboration。
4. **E3.4 集成诊断**：能力清单、默认项配置和包体 tree-shaking 验证。

### 验收标准

- 重复 ID、主版本不兼容、环境不匹配在注册阶段失败，且不改变已有 snapshot。
- 多个匹配 adapter 且无显式/默认选择时稳定报错，不依赖注册顺序碰运气。
- scope 取消能终止对应异步调用，释放后不能再次调用。
- 未安装可选 adapter 时，核心编辑、模板编译、预览和已有本地输出仍正常工作。
- 浏览器 bundle 不因注册表静态引用而包含未导入的 PDF、XLSX、Solver 或协作实现。
- 权限测试证明 adapter 只能访问声明且获授权的 capability。
- 资源账本证明初始化失败、正常释放和部分释放失败均无遗留监听器与 worker。

### 依赖与已决决策

依赖：统一 Diagnostic、ResourceLimits、CapabilityGrant、AbortSignal、各 adapter kind 的独立协议。

已决决策：

- registry 负责发现与生命周期，不负责远程安装。
- 选择有歧义时失败，不做隐式最佳猜测。
- 凭证只存在于宿主提供的 scope，不进入文档或 registry。
- adapter 可选且可 tree-shake，核心不依赖具体实现。
- capability context 是 SDK 的强制 API 边界；对同 realm 的 `trusted-main` 代码不构成安全沙箱。安全隔离只由 `isolated-worker` 协议提供。

## 能力域完成定义

当 E1–E3 的协议、类型测试、资源账本测试、异常隔离测试和至少一个参考实现全部通过后，Extensibility 能力域才可从 `planned` 进入 `in-progress`。在协议首个稳定主版本发布前，不对第三方扩展承诺长期兼容。
