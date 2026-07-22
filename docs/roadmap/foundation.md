# Foundation Mini-RFC

**Status:** planned
**Owner:** tego-sheet core team
**Product boundary:** 可嵌入业务系统的组件与 TypeScript SDK
**Priority:** Template Printing 的阻塞依赖
**Enables:** [模板打印与文档生成](./template-printing.md)

## 1. 总体定义

Foundation 建立下一代文档状态、修改边界、公式/格式语义和统一展示语义。它不是为了保留当前稀疏 JSON、`TegoSheet` ref API 或内部 Canvas 结构，而是为了使模板编译、确定性分页、后续 XLSX 互操作和宿主适配器拥有单一可靠契约。

### 1.1 已决共同原则

- 产品保持 React 组件与 TypeScript SDK，不内建文件管理、账号、协作后端或云服务。
- 允许破坏性更新；迁移工具和回归测试替代长期双轨兼容。
- `SpreadsheetDocument` 是文档真相，React、Canvas、DOM、选择状态和公式计算缓存不进入持久化模型。
- 所有结构性修改必须经过 Command/Transaction；任何 UI、插件和 adapter 都不能直接修改文档对象。
- Excel/XLSX 是 A1 引用、错误值、日期序列、数字格式代码和函数名称的主要兼容基准，但每项能力单独声明支持范围。
- 相同 snapshot、locale、时区、日期系统和字体度量必须产生相同公式结果、显示文本和打印几何。
- Roadmap 中本能力域所有项目状态均为 `planned`。

### 1.2 共享标识和坐标

`DocumentId`、`SheetId`、`StyleId`、`ValidationId`、`BindingId`、`ObjectId` 和 `ResourceId` 是文档内稳定 opaque ID。公开 API 使用零基行列索引和结构化地址；A1 字符串只用于公式源文本、导入导出和用户展示。

```ts
interface CellAddress {
  sheetId: SheetId;
  row: number;
  column: number;
}

interface CellRange {
  sheetId: SheetId;
  start: { row: number; column: number };
  end: { row: number; column: number };
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
```

范围始终规范化为包含式、左上到右下。空范围不进入文档；非法地址在命令验证阶段拒绝。

### 1.3 共享诊断契约

所有 capability 使用同一 `Diagnostic`，不得在子模块重新定义字段不同的变体。`domain` 表示问题归属，`stage` 表示失败发生的处理阶段；一个能力涉及多个领域时选择最接近用户可采取行动的领域，例如 XLSX 解码归 `interchange`、Pivot 刷新归 `analysis`、Version History 保存归 `history`。

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

可恢复的用户数据问题进入结果中的 diagnostics；公开 API 使用错误码、位置和结构化 details，不要求调用方解析 message。编程契约错误才抛异常。异步能力支持 `AbortSignal`，取消使用稳定的 `OPERATION_ABORTED` 诊断或约定的 abort exception，具体选择由对应 API 声明。

---

## F1. Workbook 2.0

**Status:** planned
**Delivery:** Foundation Phase 1

### 产品目标与场景

提供能长期承载普通表格、模板、打印配置、资源、图表和宿主扩展的明确文档模型。用户编辑单元格、插入行列或重命名工作表后，公式、模板区域和打印区域必须保持一致。开发者可以序列化、克隆、比较和验证文档，而不依赖 React 或 DOM。

### 范围

- 多工作表文档、稳定 ID、稀疏单元格存储、样式/验证/资源注册表。
- 明确的单元格输入类型：空白、字符串、数字、布尔和公式。
- 模板作为文档一级集合，print profile 归属于对应模板。
- 行列尺寸、隐藏、冻结、合并和对象锚点的规范模型。
- schema version、确定性序列化、完整验证和一次性迁移入口。
- 日期以 Excel 序列数字与数字格式保存，支持显式 1900/1904 日期系统。

### 非目标

- 保存 React 节点、Canvas 对象、DOM 引用、选区、滚动位置、hover 状态或打开的对话框。
- 把公式计算缓存作为文档真相。
- 无损保留任意旧 JSON 字段或未知 OOXML 部件。
- 内建远程持久化、权限、评论或协作协议。
- 在同一运行时长期维护旧模型和 Workbook 2.0 两套 controller。

### UX 与公开 API

普通用户看到的是一致的工作簿行为；破坏性变化主要面向开发者。文档加载失败时组件展示不可编辑错误状态和完整诊断，不呈现部分工作簿。新建文档由显式工厂产生，不使用 `{}` 或空数组的隐式特殊语义。

```ts
interface SpreadsheetDocument {
  schemaVersion: 2;
  id: DocumentId;
  workbook: Workbook;
  templates: SpreadsheetTemplate[];
  resources: ResourceStore;
  extensions: ExtensionStore;
}

interface Workbook {
  sheets: Sheet[];
  styles: StyleRegistry;
  validations: ValidationRegistry;
  settings: WorkbookSettings;
}

type CellInput =
  | { type: 'blank' }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'formula'; source: string }
  | {
      type: 'custom';
      cellType: string;
      schemaVersion: number;
      value: JsonValue;
    };

interface Cell {
  input: CellInput;
  styleId?: StyleId;
  validationId?: ValidationId;
  metadata?: CellMetadata;
}

function createSpreadsheetDocument(options?: CreateDocumentOptions): SpreadsheetDocument;
function parseSpreadsheetDocument(input: unknown): DocumentParseResult;
function serializeSpreadsheetDocument(document: SpreadsheetDocument): string;
function migrateLegacyWorkbook(input: unknown): MigrationResult;
```

### 数据模型

工作表按顺序存储，sheet 名称只负责展示和公式序列化，内部关系引用 `SheetId`。行、列和单元格继续使用稀疏集合，但集合 API 隐藏底层 representation，调用者不能依赖对象键结构。样式和验证规则通过 ID 去重；删除未使用注册项是显式压缩命令，不在普通序列化中隐式改变 ID。

公式单元格只保存源文本和可选的解析版本提示，AST、依赖和结果属于派生状态。日期、时间和 duration 使用数值与 format 表达；`WorkbookSettings.dateSystem` 明确为 `excel-1900 | excel-1904`。文档保存 `localeHint` 只用于默认展示，实际渲染 locale 必须由环境明确解析。

模板、命名范围、表格、条件格式和浮动对象均以文档或 workbook 的独立集合持有，并通过 ID/结构引用关联工作表和区域。Print profile 归属于对应 `SpreadsheetTemplate`，不在 workbook 建立第二份配置真相。`custom` 单元格只保存 JSON 可序列化值；Foundation 提供内建 Cell Type 协议供下拉和复选框使用，Phase 4 再公开同一协议给第三方插件。`extensions` 只能保存命名空间化、JSON 可序列化且通过宿主 schema 校验的数据。

内建自定义单元格通过 F5 的 Cell Type Kernel 解析。F1 只持久化稳定的 `cellType`、`schemaVersion` 和 JSON 值，不在文档中保存实现或运行时 registry。

### 内部模块与数据流

```text
unknown input
  -> SchemaDecoder
  -> Canonicalizer
  -> CrossReferenceValidator
  -> immutable SpreadsheetDocument snapshot
  -> selectors / formula graph / presentation / template compiler

snapshot
  -> DeterministicSerializer
  -> schemaVersion 2 JSON
```

`SchemaDecoder` 只处理形状和局部类型；`CrossReferenceValidator` 验证 ID 唯一性、引用存在、范围合法、合并无冲突和 registry 索引。成功后冻结根 snapshot；运行期修改通过 structural sharing 产生新 snapshot。

### 错误、性能与安全

- 错误码包括 `DOCUMENT_SCHEMA_INVALID`、`UNSUPPORTED_SCHEMA_VERSION`、`DUPLICATE_ID`、`DANGLING_REFERENCE`、`INVALID_RANGE`、`INVALID_MERGE`、`INVALID_EXTENSION_DATA` 和 `DOCUMENT_LIMIT_EXCEEDED`。
- 加载必须原子化；任意 error 都不暴露部分文档。
- 限制 sheet、行列索引、非空单元格、样式、验证、对象、模板和扩展数据总字节。
- 解析不执行公式、扩展数据或资源 URL。
- 序列化排序固定：工作表和显式列表保持用户顺序，registry 和稀疏坐标使用稳定 ID/数字顺序。
- snapshot 对外只读，controller ingress/egress 不共享可变引用。

### 迁移与破坏性更新策略

- 新 React API 使用 `document/defaultDocument/onDocumentChange`，不再以旧 `WorkbookInput` 为核心契约。
- 提供纯函数 `migrateLegacyWorkbook()`，把旧 `text`、style index、rows/cols/merges 等转换到 schema 2，并返回逐项诊断。
- 无法可靠映射的旧字段产生 error 或明确的 dropped-feature warning；不会原样塞入隐式 extension bag。
- 新序列化器只输出 schema 2。迁移完成后删除旧模型写路径和直接 mutable data API。
- 迁移 fixture 覆盖当前项目支持的每个旧字段、显式 falsy 值、稀疏索引、公式和打印属性。

### 分阶段交付

1. schema、稳定 ID、稀疏集合接口、schema validator 和确定性序列化。
2. 单元格 typed input、style/validation registry、工作表结构与日期系统。
3. 模板、print profile、资源和扩展命名空间。
4. 旧数据迁移器、差异报告和 fixture。
5. controller/read model 切换并删除旧写路径。

### 验收标准

- 任意有效文档经过 serialize/parse 后结构和语义等价，输出字节顺序稳定。
- string、number、boolean、blank、formula、日期序列和显式空字符串不丢失类型。
- sheet 重命名不改变 `SheetId` 关系；删除被引用 sheet 被命令验证阻止或按显式策略转换。
- 无效引用、重复 ID、冲突合并和超限文档加载原子失败并定位路径。
- snapshot 深层只读；调用方输入、输出和 change callback 之间不存在可变引用共享。
- 旧 fixture 迁移报告包含每个转换和降级，迁移后可由新模型完成编辑和打印编译。

### 依赖与已决决策

- Foundation 首个交付，无前置新模块。
- 稀疏存储是内部实现，不是公开 JSON 契约。
- 日期统一使用 Excel 序列值与数字格式，不在单元格模型中保存 JavaScript `Date`。
- schema 2 是新真相来源，旧 schema 仅通过迁移器进入。

---

## F2. Command / Transaction

**Status:** planned
**Delivery:** Foundation Phase 2

### 产品目标与场景

确保单元格编辑、批量粘贴、插入行列、模板区域调整和数据清理是原子、可撤销、可诊断的操作。未来持久化和协作 adapter 可以消费同一 transaction，而无需监听任意对象变化。

### 范围

- Intent Command、验证、规范化、原子 Patch、inverse Patch、提交事件、undo/redo。
- 单命令与多命令 transaction。
- 结构命令统一转换公式、命名范围、合并、验证、条件格式、模板绑定、print profile 和对象锚点。
- dry-run、变更摘要、权限检查插槽和可序列化 transaction。
- React 订阅已提交 snapshot 和单次 change event。

### 非目标

- 在核心中选择 OT 或 CRDT 算法。
- 允许插件直接提交 Patch 或修改 snapshot。
- 对失败 transaction 暴露部分结果。
- 将 selection、滚动、面板状态等 session UI 状态放入文档 undo 栈。
- 用完整 snapshot 副本实现每一步 undo。

### UX 与公开 API

用户的一次意图对应一次撤销单位，例如粘贴 10,000 个单元格、删除重复或模板展开配置变更均一次撤销。命令被拒绝时 UI 保持原状态并聚焦首个诊断位置。批量数据变换先 dry-run 展示影响范围和 warning，再由用户确认提交。

```ts
interface DocumentController {
  execute(command: Command, options?: ExecuteOptions): CommandResult;
  transact(commands: readonly Command[], options?: TransactionOptions): TransactionResult;
  dryRun(commands: readonly Command[]): TransactionPreview;
  undo(): TransactionResult;
  redo(): TransactionResult;
  snapshot(): SpreadsheetDocument;
  subscribe(listener: DocumentChangeListener): Unsubscribe;
}

interface Transaction {
  id: TransactionId;
  baseRevision: Revision;
  commands: readonly SerializableCommand[];
  patches: readonly Patch[];
  inverse: readonly Patch[];
  diagnostics: readonly Diagnostic[];
  metadata: TransactionMetadata;
}
```

### 数据模型

Command 是带版本的判别联合，表达用户意图，例如 `SetCellInput`、`InsertRows`、`DeleteColumns`、`MoveRange`、`SetTemplateBinding` 和 `SetPrintProfile`。只有命令 handler 可创建内部 Patch。Patch 使用稳定 ID 和规范路径，不以 UI index 暗示身份。

Transaction 持有 base revision、命令、正向 patch、逆 patch 和元数据。inverse 只保存恢复所需的最小旧值。Undo 提交一个新的 revision 并应用 inverse；Redo 重新应用原 transaction 的语义化 patch。远程 transaction 的撤销策略由 collaboration adapter 提供，但仍通过 controller 验证。

### 内部模块与数据流

```text
UI / SDK / plugin intent
  -> CommandSchemaValidator
  -> PermissionGate
  -> CommandNormalizer
  -> CommandHandler
  -> PatchPlanner
  -> CrossReferenceTransformer
  -> InvariantValidator
  -> atomic Commit
  -> revision + snapshot + one change event
```

结构转换器接收行列插入、删除、移动的 `CoordinateTransform`，依次更新单元格、公式 AST 引用、名称、表格、合并、验证、条件格式、模板区域、打印区域和对象锚点。所有转换在 candidate snapshot 上完成；最终 invariant 校验通过后一次交换 controller 当前 snapshot。

### 错误、性能与安全

- 错误码包括 `COMMAND_SCHEMA_INVALID`、`COMMAND_NOT_ALLOWED`、`REVISION_CONFLICT`、`TRANSACTION_INVARIANT_FAILED`、`UNDO_NOT_AVAILABLE`、`REDO_NOT_AVAILABLE`、`REFERENCE_TRANSFORM_FAILED` 和 `TRANSACTION_LIMIT_EXCEEDED`。
- 命令 payload 经 schema 校验并限制单次操作单元格数、字符串字节和 patch 数。
- Patch 是核心内部类型，不接受外部反序列化后直接应用。
- 大型命令可在 Worker 生成受验证的命令计划，但主线程 controller 是唯一提交者。
- structural sharing 和范围级 patch 避免整文档复制；事件只携带 change summary 和新 revision，不复制整个文档。
- transaction 执行中抛错时丢弃 candidate snapshot，当前 revision 不变。

### 迁移与破坏性更新策略

- 删除对 workbook 内部对象的公开可变访问和 UI 直接赋值路径。
- 所有现有编辑行为逐项迁移为 command；未迁移行为不得绕过 controller 临时保留。
- 旧 history 记录不跨版本迁移，加载文档后从空 undo 栈开始。
- ref API 中的 setter 改为调用命令并返回结构化结果；错误不再只通过 console 或异常字符串表达。

### 分阶段交付

1. controller、revision、基础 cell/sheet commands、原子提交和事件。
2. patch/inverse、undo/redo 和 property-based round-trip 测试。
3. 行列/范围结构命令和统一坐标转换器。
4. 模板、打印、验证、条件格式、对象等所有 cross-reference 转换。
5. dry-run、权限 gate、transaction serialization 和大操作 Worker 计划。

### 验收标准

- 每个命令要么完整提交一个 revision，要么文档字节级不变。
- 任意可逆 transaction 执行后 undo 恢复语义等价文档，redo 恢复提交结果。
- 插入/删除/移动行列后，公式、合并、验证、模板区域和打印区域按同一坐标变换更新。
- 一次批量操作只触发一个 committed change event 和一个 undo 项。
- base revision 不匹配时在修改前返回 `REVISION_CONFLICT`。
- property-based 测试覆盖命令序列、inverse、序列化和 invariant。

### 依赖与已决决策

- 依赖 F1 的不可变 snapshot、稳定 ID 和 invariant validator。
- 外部只能提交 Command，不能提交 Patch。
- undo/redo 使用逆补丁，不保存完整 snapshot 副本。
- 文档状态与 session UI 状态使用独立历史。

---

## F3. Formula & Format Core

**Status:** planned
**Delivery:** Foundation Phase 3

### 产品目标与场景

为日常表格计算、模板数据绑定后的重算、屏幕显示和跨格式输出提供一致的 Excel 导向语义。编辑一个输入单元格时只重算受影响公式；模板展开后能够正确转换引用并得到确定结果。

### 范围

- A1 相对/绝对引用、范围、跨表引用、基本运算和函数调用。
- 标准错误：`#REF!`、`#VALUE!`、`#DIV/0!`、`#NAME?`、`#N/A`、`#NUM!`、`#SPILL!`。
- typed AST、依赖图、循环检测、脏节点增量重算和稳定计算顺序。
- 首期函数库覆盖现有函数并建立扩展注册表；函数名称和参数行为按明确兼容表实现。
- Excel 数字、货币、百分比、科学计数、日期、时间和自定义数字格式。
- 计算值模型预留数组值，以支持后续动态数组和溢出公式。

### 非目标

- 首期完整 Excel 函数集、动态数组 UI、命名范围 UI 或异步函数打印。
- 执行 Excel 宏、JavaScript 或任意宿主函数。
- 根据本机隐式 locale、时区或当前时间改变确定性输出。
- 把格式化文本写回单元格值。
- 宣称 Google Sheets 特有函数默认兼容；它们通过扩展模块提供。

### UX 与公开 API

公式栏显示源公式；单元格显示格式化结果。错误单元格显示标准错误值并提供依赖/诊断详情。用户输入日期或百分比时，解析器根据显式 locale 生成数值和格式，而不是永久保存本地化字符串。

```ts
interface FormulaEngine {
  compile(document: SpreadsheetDocument): FormulaProgram;
  recalculate(
    program: FormulaProgram,
    changes: readonly DependencyChange[],
    environment: CalculationEnvironment,
  ): CalculationResult;
}

type FormulaValue =
  | { type: 'blank' }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'error'; value: FormulaError }
  | { type: 'array'; rows: readonly (readonly ScalarFormulaValue[])[] };

interface NumberFormatter {
  parse(code: string): NumberFormatAst;
  format(value: FormulaValue, code: string, context: FormatContext): string;
}
```

### 数据模型

公式 parser 将源文本转为带 source span 的 AST。引用节点同时保存显示用 sheet/name token 和解析后的稳定引用；结构命令修改 AST 后再规范化源文本。依赖图以 cell/name/table 为节点，边标记引用种类。计算结果缓存在 `FormulaProgram`，不写入 `SpreadsheetDocument`。

`CalculationEnvironment` 明确包含 locale、时区、日期系统、当前时间提供器和函数注册表版本。易变函数通过显式 tick 失效；测试使用固定 clock。函数定义声明名称、参数约束、返回类型、易变性和 `sync | async` 执行模式。

数字格式 parser 生成 AST，处理正数、负数、零、文本四 section、颜色/条件 token、日期时间 token、转义和 literal。首期不支持的 token 产生诊断而非近似猜测。

### 内部模块与数据流

```text
cell formula source
  -> Lexer -> Parser -> typed AST -> ReferenceResolver
  -> DependencyGraph
changes -> DirtySet -> topological scheduler -> evaluator
  -> FormulaValue / FormulaError
  -> NumberFormatParser + Formatter
  -> formatted text
```

模板展开先通过 F2 坐标转换器复制和重写 AST，再批量更新依赖图，最后执行一次受影响节点重算。屏幕、打印、PDF 和 XLSX 都消费相同 typed value 和格式定义；XLSX serializer 另行输出公式源与当前缓存结果。

### 错误、性能与安全

- 诊断码包括 `FORMULA_PARSE_ERROR`、`FORMULA_UNKNOWN_FUNCTION`、`FORMULA_CIRCULAR_REFERENCE`、`FORMULA_REFERENCE_INVALID`、`FORMULA_EVALUATION_LIMIT_EXCEEDED`、`NUMBER_FORMAT_INVALID` 和 `ASYNC_FORMULA_NOT_RESOLVED`。
- evaluator 只解释 AST，不使用 `eval`、`Function` 或动态属性访问。
- 函数接收冻结值和受限 context，不能访问 DOM、controller、全局对象或可变 Workbook。
- 限制公式长度、AST 节点数、依赖边数、递归深度、数组尺寸和单次重算时间。
- 异步函数结果必须带输入 revision；过期结果不得写入当前计算缓存。
- 打印默认拒绝未解析异步或易变结果，宿主必须先提供固定结果/clock。

### 迁移与破坏性更新策略

- 旧公式字符串通过新 parser 迁移；无法解析的公式保留源文本并标记 error，不沿用旧计算缓存。
- 旧 cell `value` 缓存不作为迁移后的真相；加载后重建依赖图并重算。
- 数字格式代码迁移到 Excel 导向格式；不等价的旧格式产生逐单元格或样式诊断。
- 旧公式 evaluator 和格式化分支在兼容 fixture 通过后删除。

### 分阶段交付

1. lexer/parser、typed value/error、A1/范围/跨表引用和基础 evaluator。
2. 依赖图、循环检测、增量重算和固定 clock。
3. 函数 registry 与首期 Excel 兼容函数矩阵。
4. 数字格式 parser/formatter、日期系统、locale 和时区 fixture。
5. 模板结构转换集成、数组值预留和 XLSX 互操作 fixture。

### 验收标准

- 相对、绝对、混合和跨表引用在复制、插入、删除和模板重复后结果正确。
- 修改一个输入只重算传递依赖节点，独立公式不执行。
- 循环引用稳定返回错误并列出最小环路。
- 标准错误值传播符合已声明的 Excel 兼容用例。
- 相同计算环境产生相同 typed value 和 formatted text。
- 数字、货币、百分比、日期、时间和自定义格式在屏幕、打印、PDF 与 XLSX fixture 中一致。
- 每个已支持函数与格式都有 Excel/XLSX 互操作测试和明确兼容声明。

### 依赖与已决决策

- 依赖 F1 typed cells 和 F2 结构转换。
- Excel/XLSX 是主要基准，但只承诺测试矩阵列出的函数和格式。
- Google Sheets 特有函数不进入默认核心。
- 异步函数可用于交互工作簿，但进入确定性打印前必须解析为固定结果。

---

## F4. Render Semantics & Accessibility

**Status:** planned
**Delivery:** Foundation Phase 4

### 产品目标与场景

让编辑 Canvas、无障碍 DOM、模板预览和打印编译器对同一个单元格具有相同的值、格式、样式和可见性理解。键盘和屏幕阅读器用户能够感知活动单元格、选区、编辑状态和错误，而打印不再截图当前 viewport。

### 范围

- 统一 `CellPresentation` 和解析后的样式语义。
- Canvas 编辑 renderer 消费只读 snapshot/presentation。
- 虚拟化 DOM grid 语义层，提供 row/gridcell、焦点、选区和编辑状态。
- `PrintDisplayList`：文本、线、矩形、图片、矢量 path、clip 和链接等确定性绘制指令。
- 显式注入字体度量、locale、时区、日期系统和 device-independent 单位。
- 屏幕与打印共享 cell presentation，但拥有不同布局 viewport。

### 非目标

- 用完整 DOM 表格替换高性能 Canvas 编辑器。
- 从屏幕截图生成打印页面。
- 将工具栏、dialog 或浮层纳入文档语义。
- 在核心 renderer 中访问可变 controller。
- 首期完成所有高级对象的 WCAG 认证；每类对象必须至少提供可访问名称和文本摘要接口。

### UX 与公开 API

屏幕阅读器获得工作表名、行列坐标、显示文本、公式状态、验证错误、选区范围和只读状态。焦点始终由单一活动单元格代表；大范围选择使用 `aria-describedby` 摘要，避免为每个选中格产生事件洪水。进入编辑时，焦点转移到受控 editor，提交或取消后回到原单元格。

模板和打印边界是视觉装饰，不进入单元格值；对应状态通过属性面板和可访问描述暴露。

```ts
interface CellPresentation {
  address: CellAddress;
  value: FormulaValue;
  formattedText: string;
  style: ResolvedStyle;
  validationState?: ValidationState;
  annotations: readonly Annotation[];
  visibility: 'visible' | 'hidden-row' | 'hidden-column';
}

interface PresentationResolver {
  resolveCell(
    snapshot: SpreadsheetDocument,
    address: CellAddress,
    environment: PresentationEnvironment,
  ): CellPresentation;
}

interface PrintDisplayList {
  pageSize: Size;
  commands: readonly DrawCommand[];
}
```

### 数据模型

`ResolvedStyle` 是基础样式、行列默认样式和条件格式叠加后的不可变结果。`formattedText` 由 F3 统一 formatter 产生。Annotation 统一表达 comment marker、validation warning、formula error 和模板设计提示，并声明是否进入 screen、accessibility 或 print channel。

字体度量接口接收 font face、size、weight、style 和文本，返回稳定 advance、ascent、descent 和换行信息。打印使用 device-independent 长度；屏幕 renderer 最后一步按 devicePixelRatio 映射像素。

### 内部模块与数据流

```text
SpreadsheetDocument snapshot + FormulaProgram
  -> PresentationResolver
  -> CellPresentation cache
  +-> CanvasLayout -> CanvasRenderer
  +-> AccessibilityViewport -> semantic DOM grid
  +-> PrintLayout -> paginator -> PrintDisplayList
```

cache key 包含 document revision、calculation revision、style/condition revision 和 presentation environment。屏幕只计算可见 viewport 与 overscan；打印按 print target 分块计算，不能读取当前 scroll 或 selection。无障碍层和 Canvas 使用同一 geometry service 得到活动单元格位置。

### 错误、性能与安全

- 错误码包括 `PRESENTATION_RESOLUTION_FAILED`、`FONT_METRICS_UNAVAILABLE`、`ACCESSIBILITY_FOCUS_INVALID`、`DRAW_COMMAND_UNSUPPORTED` 和 `PRESENTATION_CACHE_LIMIT_EXCEEDED`。
- 用户文本通过 Canvas API、text node 或经过转义的 SVG 输出，不作为 `innerHTML`。
- 无障碍 DOM 仅渲染 viewport 与有限 overscan，滚动时复用节点并保持活动单元格可访问。
- presentation cache 有条目和字节预算；revision 变化做范围失效。
- 字体未加载时屏幕可显示受控 fallback 状态，但模板正式分页必须等待指定字体或失败。
- renderer 只能接收 snapshot/selectors，不得获取 controller mutation capability。

### 迁移与破坏性更新策略

- 将现有 Canvas 内部的值格式化、样式合并和打印测量迁出为共享 resolver。
- 删除从当前 Canvas/viewport 生成打印输出的路径。
- renderer API 改为消费 snapshot 与 presentation batch；现有直接读取 mutable data proxy 的接口不保留。
- 逐层迁移期间使用屏幕/print 黄金 fixture 锁定支持的旧视觉语义；已知缺陷不作为兼容目标。

### 分阶段交付

1. `CellPresentation`、ResolvedStyle、formatter 集成和 cache。
2. Canvas renderer 切换到 presentation batch 和只读 geometry service。
3. 虚拟化 DOM grid、焦点、选区、编辑和错误语义。
4. `PrintDisplayList`、字体度量注入和无 viewport 分页输入。
5. 屏幕/无障碍/打印一致性测试、性能预算和旧渲染读取路径删除。

### 验收标准

- Canvas、无障碍层和打印对同一单元格报告相同 formatted text、错误与可见性。
- 活动单元格、单/多范围选择、编辑开始/结束和只读状态可被主流屏幕阅读器感知。
- 100 万行稀疏工作表不会创建与总行数成正比的 DOM 节点。
- 打印结果不受当前 scroll、zoom、selection、devicePixelRatio 或打开的 UI 浮层影响。
- 相同 snapshot 和 presentation environment 产生相同 `PrintDisplayList`。
- renderer 层静态架构测试证明其不能导入 controller mutation API。
- 字体缺失、非法焦点和未知 draw command 产生稳定诊断且不导致资源泄漏。

### 依赖与已决决策

- 依赖 F1 snapshot、F2 revision/change summary 和 F3 typed value/formatter。
- 编辑网格保留 Canvas，DOM 只承担虚拟化语义与编辑控件。
- 屏幕、打印共享 presentation，不共享 viewport layout。
- Preview 和 Browser Print 采用 SVG/display list；PDF adapter 直接翻译 display list，不重新排版。

---

## F5. Minimal Extension & Adapter Kernel

**Status:** planned
**Delivery:** Foundation Phase 1, after F1 schema primitives

### 产品目标与场景

为核心能力提供一个小而确定的注册与查找内核，使内建下拉/复选框单元格、文件读写、资源解析、输出、图表、公式函数和 Solver 能通过同一类型化机制装配，而不是互相导入具体实现。它是 Foundation 的内部组合边界，不是第三方插件产品；Phase 4 再把该内核扩展为公开 SDK。

用户不会看到“插件市场”。当功能缺少实现或存在多个未指定的实现时，组件在对应入口展示稳定、可定位的不可用原因。宿主开发者在 Foundation 阶段只能通过包内装配或受支持的组件选项选择官方实现。

### 范围

- 版本化 `ExtensionManifest` 最小契约，以及按 kind 和 ID 注册、列举、解析、注销的 registry。
- 可声明合并的 capability type map；后续 workbook reader/writer、resource resolver、output、chart renderer、formula function provider 和 solver 在各自模块增加映射，F5 不反向依赖这些尚未交付的接口。
- 内建 Cell Type Definition，统一 value schema、与渲染层无关的值语义、公式标量 coercion 和迁移；F4 再把值语义与地址、样式、可见性组合成完整 presentation。
- 确定性的 adapter 选择规则、环境过滤、重复注册保护和测试替身注入。
- 包内 trusted implementation 的生命周期与错误隔离。

### 非目标

- 第三方 JavaScript 加载、远程安装、插件市场、依赖解析或热更新。
- 把同 realm 运行称为安全沙箱，或向不可信代码授予 controller、DOM、Canvas、网络和文件系统能力。
- 公开 React editor/renderer、Template Module、宿主 adapter 或稳定的第三方兼容承诺。
- persistence、collaboration、permission、comments、version history 和 AI adapter；这些由 Phase 4 公共 registry 扩展。
- 用 registry 绕过 Command/Transaction、资源策略、浏览器权限或服务端授权。

### 内部 API 与类型定义

F5 API 标记为 `@internal`，可在 Phase 4 前破坏性调整。`ExtensionManifest` 是运行时注册记录，不进入 `SpreadsheetDocument`。Phase 4 的 public manifest 在此基础上增加 execution、capabilities、trust policy 和兼容窗口。

```ts
type ApiVersion = `${number}.${number}`;

type CellTypeScalar = null | string | number | boolean;

interface CellTypeSemantics {
  formattedText: string;
  accessibilityLabel: string;
  role: 'text' | 'checkbox' | 'combobox';
  checked?: boolean;
}

interface BuiltInCellTypeDefinition<Value extends JsonValue> {
  readonly id: string;
  readonly schemaVersion: number;
  validate(value: JsonValue): value is Value;
  migrate?(value: JsonValue, fromVersion: number): Value;
  describe(
    value: Value,
    environment: { locale: string; timeZone: string },
  ): CellTypeSemantics;
  toFormulaScalar(value: Value): CellTypeScalar;
}

// Open internal map. Capability modules augment it without changing the kernel.
interface KernelCapabilities {
  'cell-type': BuiltInCellTypeDefinition<JsonValue>;
}

type KernelExtensionKind = keyof KernelCapabilities & string;

interface ExtensionManifest {
  id: string;
  apiVersion: ApiVersion;
  kind: KernelExtensionKind;
  environments: readonly ('browser' | 'worker' | 'node')[];
}

interface KernelContext {
  readonly environment: 'browser' | 'worker' | 'node';
  readonly signal: AbortSignal;
  readonly diagnostics: (diagnostic: Diagnostic) => void;
}

interface KernelRegistration<K extends KernelExtensionKind> {
  readonly manifest: ExtensionManifest & { kind: K };
  readonly implementation: KernelCapabilities[K];
  initialize?(context: KernelContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

interface AdapterRegistryKernel {
  register<K extends KernelExtensionKind>(
    registration: KernelRegistration<K>,
  ): Promise<() => Promise<readonly Diagnostic[]>>;
  list(kind?: KernelExtensionKind): readonly ExtensionManifest[];
  resolve<K extends KernelExtensionKind>(
    kind: K,
    query: { id?: string; environment: 'browser' | 'worker' | 'node' },
  ): KernelCapabilities[K];
  dispose(): Promise<readonly Diagnostic[]>;
}
```

Registry 不自动选择“最像”的实现。指定 ID 时必须精确匹配；未指定 ID 时，同 kind、同环境只有一个候选才可解析，否则返回诊断。调用方拿到的是 `KernelCapabilities[K]` 的精确类型，而不是 `unknown` 或无约束 service locator。TP、IO、Formula、Chart 和 Solver 模块通过 TypeScript declaration merging 增加自己的 kind/type pair；F5 只稳定 registry 泛型、manifest 和生命周期，不导入消费者接口。

`CellTypeSemantics` 只描述该值自身的文本、无障碍角色和结构化状态。F4 `PresentationResolver` 负责把它与 `CellAddress`、resolved style、visibility、annotation 和 geometry 合并，并据此产生 screen/accessibility/print channel；因此 F5 不需要也不能提前构造 `CellPresentation` 或 `DrawCommand`。

### 数据模型与生命周期

文档只保存自定义单元格的 type ID、schema version 和 JSON value。Manifest、实现对象、缓存、AbortController 和 dispose handle 都是运行时状态，不序列化。内建注册表由 package bootstrap 创建，每个 `Spreadsheet`/controller scope 获取只读解析视图；测试可以创建隔离 registry，不污染全局状态。

```text
package bootstrap
  -> validate manifests
  -> initialize and register trusted built-ins
  -> freeze registration scope

feature request
  -> resolve(kind, id, environment)
  -> validate input and resource limits
  -> invoke through capability-specific interface
  -> collect shared Diagnostic
  -> dispose scoped resources
```

同一 `kind + id` 不得重复注册。注册顺序不参与默认选择，`list()` 按 kind、id 稳定排序。版本比较只接受运行时支持的 major；minor 高于运行时版本时拒绝，避免实现读取不存在的上下文字段。

`register()` 先验证 manifest，再调用 `initialize()`，只有成功后才原子发布到可解析集合。初始化失败时调用该 registration 的 `dispose()` 做补偿清理并返回聚合 diagnostics；既不能留下半注册项，也不能影响已存在的实现。返回的 unregister handle 和 registry 全局 `dispose()` 使用同一幂等释放状态机，重复调用不重复释放资源。

### 错误、性能与安全

- 错误码包括 `EXTENSION_MANIFEST_INVALID`、`EXTENSION_API_INCOMPATIBLE`、`EXTENSION_DUPLICATE_ID`、`EXTENSION_NOT_FOUND`、`EXTENSION_AMBIGUOUS`、`EXTENSION_ENVIRONMENT_UNSUPPORTED`、`CELL_TYPE_VALUE_INVALID` 和 `EXTENSION_DISPOSE_FAILED`。
- diagnostics 使用共享契约，domain 为 `extension`，加载/执行/释放分别使用 `validate`、`execute`、`dispose` stage；具体输出或资源错误可归到更贴近用户操作的 domain。
- F5 只装配仓库随包发布、构建时已知的 trusted code；它不提供隔离保证。不可信计算必须等待 Phase 4 的 `isolated-worker` 执行模式，并且 DOM/React editor 仍只能属于显式 trusted-main 插件。
- 实现只接收 capability-specific 输入、只读 snapshot、limits 和 `AbortSignal`，不能取得 controller mutation API。
- registry resolve 为 O(1) ID 查找；list 为缓存的稳定视图。实现调用各自遵循资源、时间、并发和输出大小预算。
- unregister/dispose 依次等待每个 registration 的异步 `dispose`；即使部分失败也继续清理其余实现并返回聚合 diagnostics，不得留下未捕获异步任务。

### 迁移与破坏性更新策略

- 把现有直接 import 的打印输出、文件解析和内建复合单元格逐步改为 registry 装配；迁移期不维护第二套公开插件 API。
- 旧的任意 renderer callback 不自动包装为 cell type；官方下拉和复选框先迁移并建立 fixture。
- Phase 4 可以破坏 F5 的 `@internal` 命名，但必须保留文档内 `cellType/schemaVersion/value` 的可迁移语义，并提供内建类型迁移测试。
- E1 将 Cell Type protocol 公开给受信插件；E3 扩展 manifest、adapter kinds、生命周期、capability 与 trust policy，而不是建立平行 registry。

### 分阶段交付

1. 定义 manifest、kind/type map、版本校验、稳定选择规则和隔离 registry 测试工具。
2. 实现内建 Cell Type Kernel，迁移 checkbox/dropdown 的验证、值语义和公式标量 coercion；F4 接入后再完成 screen/accessibility/print 组合。
3. 接入 resource/output 以支撑 TP1–TP6，并验证 browser/worker/node 环境过滤。
4. 接入 workbook reader/writer、formula function provider、chart renderer 和 solver，删除对应 service locator/direct import 分支。
5. 加入生命周期、限制、共享 diagnostics、静态导入边界和资源清理回归测试。

### 验收标准

- F5 内建 `cell-type` 以及后续模块声明合并的每个 kind，在 TypeScript compile test 中保持 `KernelCapabilities` 精确类型，错误 kind/implementation 组合不能编译。
- 重复 ID、不兼容版本、环境不匹配、零候选和多候选产生稳定 diagnostics，且不因注册顺序改变。
- 自定义单元格 round-trip 只包含 JSON 值；已知 schema 迁移可重复，未知或非法 value 原子失败并定位单元格。
- checkbox/dropdown 的 screen、accessibility、print 和公式标量最终都来自同一个 definition 的 `CellTypeSemantics`，F4 只组合地址、样式、可见性和 geometry；该边界有黄金 fixture。
- adapter 不能导入 controller mutation API；失败调用不改变文档 snapshot。
- lifecycle 测试覆盖成功、部分初始化失败、取消、单项 unregister、全局 dispose 和多错误聚合，不留下 listener、异步任务或 object URL。
- browser、worker、node 三种测试环境只解析 manifest 声明支持的实现。
- Phase 1 模板打印、Phase 3 文件交换/公式/图表/Solver 可只依赖 kernel interface 注入测试替身。

### 依赖与已决决策

- 依赖 F1 的 `JsonValue`、typed cell、稳定 ID 和只读 snapshot；F2 的修改能力仍只能通过 Command/Transaction。
- 作为 Foundation Phase 1 的后半段，在 F3、TP1 和任何 adapter 消费者实现前稳定最小接口。
- F5 是 internal composition root，不是安全边界或第三方扩展承诺。
- 公共 Cell/Template/Adapter SDK 仍在 Phase 4；其协议是 F5 的显式扩展与替换，不是重复实现。

---

## 2. Foundation 交付顺序与总验收

交付顺序固定为 F1 → F5 → F2 → F3 → F4。TP1 可以在 F4 的 `PrintDisplayList` 稳定后开始完整集成；模板 schema 设计可与 F3/F4 并行评审，但不得绕过新 controller、kernel 和 presentation 契约落地。

Foundation 完成门禁：

1. schema 2 round-trip、迁移 fixture、命令 inverse 和公式兼容矩阵全部通过；
2. 行列结构操作后，公式和全部区域元数据保持一致；
3. 相同显式环境产生确定的计算、展示和 display list；
4. Canvas、无障碍层和打印共享单元格语义；
5. 核心模块在无 React、无 DOM 环境中通过测试；
6. 旧 mutable workbook 写路径、旧公式缓存真相和旧打印 viewport 路径被删除；
7. 文档、命令、公式和渲染限制均有失败前置测试，不以耗尽浏览器内存作为保护机制。
8. 所有内建复合单元格和 capability adapter 通过 F5 类型映射装配，registry 的版本、环境、歧义与清理测试通过。
