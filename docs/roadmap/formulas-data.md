# 公式与数据能力 Roadmap

本文定义公式、格式、验证、筛选、数据整理与文件互操作的产品和技术方案。所有项目状态均为 `planned`，并以 Excel/XLSX 语义为主要兼容基准。能力建设必须服务于模板打印主线：同一文档快照在编辑器、模板预览、浏览器打印、PDF 与 XLSX 输出中使用一致的值、格式和可见性语义。

## 共同约束

- 产品保持可嵌入的组件/SDK 定位，不包含文件管理、账号、权限或云存储后端。
- 允许破坏性更新；不为未发布的旧数据结构或 API 保留并行兼容层。
- 所有文档修改通过 Command/Transaction 原子提交，并可完整撤销、重做和序列化。
- Workbook 是唯一文档真相；公式结果、条件格式结果、筛选可见性等均为可重建的派生状态。
- locale、时区、日期系统和字体度量必须显式注入，保证打印与测试的确定性。
- 受支持能力必须有 Excel/XLSX 互操作样例；不支持或降级的语义必须产生稳定诊断，禁止静默丢失。

---

## FMT-01 数字格式与条件格式

**状态：planned**

### 产品目标与场景

让业务用户无需改变原始值即可表达货币、百分比、日期、时间和业务状态，并用规则突出异常、趋势和阈值。发票、对账单等模板打印时，屏幕显示值与打印值必须一致。

### 范围与非目标

首期支持数字、货币、会计、百分比、科学计数、分数、日期、时间和 Excel 风格自定义格式代码；条件格式支持值比较、文本、日期、空白、重复值、Top/Bottom、公式、单色样式、色阶、数据条和图标集。支持规则优先级、`stopIfTrue`、多区域应用和规则管理。

首期不实现 Excel 所有地区化格式扩展、不执行 VBA 条件格式、不保证第三方表格软件的私有规则像素级一致。

### UX 与公开 API

- 格式面板提供预设、格式代码编辑、当前 locale 下的即时预览与无效代码诊断。
- 条件格式面板按优先级列出规则，支持新建、复制、调整顺序、禁用和删除；画布即时预览。
- 模板预览显示最终格式化文本；打印配置不能另行覆盖一套格式规则。

```ts
interface NumberFormatDefinition {
  code: string;
  locale?: string;
}

interface ConditionalFormatRule {
  id: RuleId;
  ranges: CellRange[];
  condition: ConditionalExpression;
  effect: StylePatch | ColorScale | DataBar | IconSet;
  priority: number;
  stopIfTrue: boolean;
}

controller.execute({ type: 'conditional-format/add', rule });
formatValue(value, format, { locale, timeZone, dateSystem });
```

### 数据模型

单元格保存类型化值和 `numberFormatId`，不保存格式化字符串。条件格式规则属于工作表级集合，并以稳定 `RuleId` 和规范化区域引用目标。条件样式是 `CellPresentation` 上的派生 `StylePatch`，不得回写基础单元格样式。

### 内部模块与数据流

```text
CellInput → FormulaValue → NumberFormatEngine → formattedText
                         ↘ ConditionalRuleIndex → StylePatch
Workbook snapshot + patches → dependency invalidation → CellPresentation
```

`NumberFormatEngine` 负责解析、编译和缓存格式代码；`ConditionalRuleIndex` 按区域和公式依赖索引规则；`PresentationResolver` 合并基础样式与命中的条件样式。屏幕与 `PrintDocument` 只消费同一 `CellPresentation`。

### 错误、性能与安全

- 稳定诊断：`INVALID_NUMBER_FORMAT`、`INVALID_CONDITIONAL_EXPRESSION`、`CONDITIONAL_RANGE_TOO_LARGE`、`UNSUPPORTED_FORMAT_FEATURE`。
- 格式代码不允许执行脚本；公式条件使用公式引擎 AST，不使用 `eval`。
- 格式编译结果按 `code + locale + dateSystem` 缓存；规则只在依赖单元格或目标区域变化时增量重算。
- 色阶、数据条与图标集对超大范围使用分块统计，并受单次重算单元格上限约束。

### 破坏性更新策略

删除以 `text` 同时承载值与展示文本的旧语义；迁移到类型化 `CellInput` 和独立格式引用。旧的渲染专用格式逻辑不保留，导入器负责显式转换并报告无法转换项。

### 实施阶段

1. 建立格式 AST、类型化值渲染和 Excel 互操作用例。
2. 实现基础条件规则、优先级与增量索引。
3. 增加色阶、数据条、图标集及打印/PDF 绘制指令。
4. 完成 XLSX 读写、规则管理 UI 与跨浏览器视觉回归。

### 验收标准

- 相同快照、locale、时区与日期系统在画布、模板预览、浏览器打印和 PDF 中产生相同文本。
- 条件格式不修改基础样式，撤销规则操作后文档完全恢复。
- 修改依赖值仅重算受影响规则。
- 已支持格式和规则可从 XLSX 导入并再次导出；降级项具有明确诊断。

### 依赖与已决决策

依赖 Workbook 2.0、Formula Core、Command/Transaction、CellPresentation 和 Print Display List。

已决策：以 Excel 格式代码为默认语义；日期保存为 Excel 序列值加数字格式；打印不维护第二套格式解释器。

---

## VAL-01 数据验证与交互式单元格

**状态：planned**

### 产品目标与场景

为录入型表格和模板提供可约束、可提示、可打印的输入控件，覆盖金额范围、日期区间、静态或动态下拉、复选框以及基于公式的业务校验。

### 范围与非目标

首期支持数字、文本长度、日期、时间、列表和自定义公式验证；支持允许空值、输入提示、错误提示以及 `reject`/`warn` 两种行为。下拉数据源支持静态列表、区域引用和宿主提供的只读 resolver；复选框支持自定义选中/未选中值。

首期不提供表单工作流、跨用户审批、远程选项写回，也不把任意 React 组件序列化进文档。

### UX 与公开 API

- 选择区域后可在验证面板中配置规则并预览有效/无效示例。
- 编辑时显示输入提示；拒绝模式阻止提交，警告模式允许用户确认后提交。
- 下拉和复选框通过 Foundation 提供的内建 Cell Type 协议呈现；打印默认输出其格式化值，`PrintProfile` 可选择保留复选框静态图形。Phase 4 的公开 Cell Extension SDK 复用同一协议，但不是本项交付的前置依赖。

```ts
interface ValidationRule {
  id: ValidationId;
  ranges: CellRange[];
  type: 'number' | 'text-length' | 'date' | 'time' | 'list' | 'formula';
  predicate: ValidationPredicate;
  behavior: 'reject' | 'warn';
  allowBlank: boolean;
  inputMessage?: Message;
  errorMessage?: Message;
}

validateEdit(snapshot, address, nextValue): ValidationResult;
```

### 数据模型

工作表保存规则集合，单元格通过区域索引匹配规则，不逐格复制规则。交互式单元格保存规范化值和 `cellTypeId`；编辑器与 renderer 由插件注册表解析。动态列表 resolver 结果属于 session 缓存，不写入文档真相。

### 内部模块与数据流

```text
Edit intent → parse typed value → ValidationEngine → reject/warn/accept
                                        ↓
                                  Command/Transaction
Validation source change → dependency invalidation → affected-cell state
```

`ValidationEngine` 复用公式 AST 和区域引用转换；`CellEditorSession` 只提交意图，不直接修改 controller；打印侧读取已提交值及 `CellPresentation`。

### 错误、性能与安全

- 稳定诊断：`INVALID_VALIDATION_RULE`、`VALIDATION_REJECTED`、`VALIDATION_SOURCE_ERROR`、`VALIDATION_SOURCE_TOO_LARGE`。
- resolver 由宿主显式注册，接收最小上下文、`AbortSignal`、超时和条目上限；核心不执行网络请求。
- 公式验证禁止异步和易变函数，避免编辑结果随时间漂移。
- 规则按区域和依赖建立索引，禁止每次键入扫描整个工作表。

### 破坏性更新策略

废弃旧式单元格内联 validation 配置和特定下拉 UI 分支，统一迁移到规则集合与 Foundation 内建 Cell Type 协议。无法映射的旧配置由文档迁移器拒绝加载并给出路径诊断。

### 实施阶段

1. 建立规则模型、同步验证引擎和编辑提交边界。
2. 实现静态/区域列表、下拉和复选框插件。
3. 加入宿主 resolver、缓存、取消与模板打印表现。
4. 完成 XLSX 验证规则互操作及可访问性测试。

### 验收标准

- reject 操作不产生任何部分 patch，warn 操作只有确认后提交一个 transaction。
- 区域插入、删除、移动后规则范围和引用正确转换。
- 下拉、复选框在画布、无障碍层和打印中表达一致。
- XLSX 支持范围内的验证可 round-trip，不支持规则明确报告。

### 依赖与已决决策

依赖 Workbook 2.0、Formula AST、Command/Transaction、Foundation 内建 Cell Type Registry、CellPresentation；不依赖 Phase 4 的第三方 Cell Extension SDK。

已决策：Dropdown/Checkbox 是“值类型 + editor + renderer”，不是验证引擎硬编码控件；打印默认输出显示值。

---

## FRM-01 高级公式引擎

**状态：planned**

### 产品目标与场景

建立可增量计算、可扩展且可与 XLSX 互操作的公式系统，为复杂业务表格、模板数据展开、图表、Pivot 和 Goal Seek 提供统一计算基础。

### 范围与非目标

覆盖 A1、绝对/相对引用、范围、跨表引用、命名范围、Excel 常用函数、数组值、动态溢出和注册式自定义函数。错误值包括 `#REF!`、`#VALUE!`、`#DIV/0!`、`#NAME?`、`#N/A`、`#NUM!`、`#SPILL!`。首期高级阶段不追求 Excel 全函数覆盖，不执行宏、LAMBDA 字符串代码或外部工作簿实时链接。

### UX 与公开 API

- 公式栏提供语法高亮、引用着色、函数签名、错误定位和依赖追踪。
- 名称管理器支持 workbook/sheet scope、重命名、冲突诊断。
- 溢出区域显示边界，用户不能编辑非锚点；阻塞时锚点显示 `#SPILL!` 及原因。

```ts
interface FunctionDefinitionBase {
  name: string;
  category: FunctionCategory;
  parameters: ParameterDefinition[];
  volatility: 'stable' | 'volatile';
}

interface SyncFunctionDefinition extends FunctionDefinitionBase {
  execution: 'sync';
  evaluate(context: FunctionContext, args: FormulaValue[]): FormulaValue;
}

interface AsyncFunctionDefinition extends FunctionDefinitionBase {
  execution: 'async';
  evaluate(
    context: AsyncFunctionContext,
    args: FormulaValue[],
  ): Promise<FormulaValue>;
}

type FunctionDefinition = SyncFunctionDefinition | AsyncFunctionDefinition;

formulaRegistry.register(definition);
recalculate(snapshot, changedNodes, environment): CalculationResult;
```

### 数据模型

文档保存公式源码，解析后的类型化 AST、依赖图、结果和溢出映射为可重建缓存。AST 引用结构使用稳定 SheetId、NameId、TableId/ColumnId，显示和 XLSX 序列化时再生成名称。`FormulaValue` 包含 scalar、array 和标准 error 联合类型。

### 内部模块与数据流

```text
formula source → tokenizer/parser → typed AST → reference binder
     → dependency graph → dirty propagation → evaluator → spill planner
     → CalculationResult → CellPresentation / template layout
```

模板先完成结构展开与引用转换，再重建受影响依赖并统一重算。结构命令直接转换 AST 引用，不使用字符串查找替换。

### 错误、性能与安全

- 解析、绑定、循环、溢出和运行时错误均映射到稳定公式错误及带位置诊断。
- 自定义函数只接收不可变上下文，不得访问 DOM、controller、全局对象或未声明网络能力。
- 打印路径默认拒绝未解析异步函数和易变函数；宿主必须先冻结结果快照。
- 依赖图支持增量脏传播、批处理和取消；数组结果受单公式单元格数、总计算步数和内存预算限制。

### 破坏性更新策略

替换任何基于正则的公式引用改写和全表重算实现。旧的函数注册签名不兼容时直接移除，由迁移说明提供新签名，不设置双适配层。

### 实施阶段

1. 完成类型化 AST、标准错误、依赖图和增量重算。
2. 扩充按类别组织的 Excel 函数兼容矩阵与互操作测试。
3. 加入命名范围、结构化引用和结构命令 AST 转换。
4. 加入数组/溢出与注册式自定义函数。
5. 完成 Worker 计算、预算控制和模板打印确定性验证。

### 验收标准

- 更改单元格只重算传递依赖节点，循环引用返回稳定错误。
- 插入/删除行列、重命名 Sheet/Table/Name 后引用语义保持正确。
- 动态数组溢出、阻塞与撤销行为确定。
- 已支持函数在项目定义的 XLSX 样例中结果一致；浮点差异遵循书面容差规则。
- 相同输入和冻结环境产生可复现的模板打印结果。

### 依赖与已决决策

依赖 Workbook 2.0、Command/Transaction、类型化值系统；被条件格式、验证、模板编译、图表、Pivot、Goal Seek/Solver 依赖。

已决策：Excel/XLSX 为主兼容目标；Google Sheets 特有函数通过扩展模块提供；公式缓存不是文档真相；异步结果不可直接进入确定性打印。

---

## VIEW-01 排序、筛选与保存视图

**状态：planned**

### 产品目标与场景

支持用户在不删除数据的前提下组织大表，并区分可共享的文档视图与不影响他人的个人 session 视图。模板输出必须明确采用哪个视图状态。

### 范围与非目标

支持多列稳定排序，按文本、数值、日期、颜色、条件、公式结果、Top/Bottom、空白和错误值筛选，以及命名 Filter View。首期不提供服务端查询、跨工作簿联合视图或持久化用户身份。

### UX 与公开 API

- 表头菜单提供排序、筛选条件、搜索值和清除操作。
- 视图栏显示当前视图、文档/session 标识、未保存修改和复制入口。
- 打印配置选择 `base`、某个 document view 或传入 session view snapshot；默认打印当前明确选定视图。

```ts
interface FilterView {
  id: ViewId;
  name: string;
  range: CellRange;
  sorts: SortDescriptor[];
  filters: FilterDescriptor[];
  visibility: 'document' | 'session';
}

applyFilterView(snapshot, view): RowVisibilityMap;
controller.execute({ type: 'sort/apply', range, descriptors });
```

### 数据模型

文档级视图序列化在 Workbook；session 视图由宿主或 React session 持有。筛选结果为 `RowVisibilityMap` 派生状态。排序是实际数据 transaction，使用稳定原始位置作为最终比较键，并同步转换公式、模板区域、对象锚点和元数据。

### 内部模块与数据流

```text
FilterView + CalculationResult → FilterEvaluator → RowVisibilityMap
Sort intent → typed comparator plan → row permutation → atomic patches
snapshot + selected visibility map → template render / print pagination
```

### 错误、性能与安全

- 稳定诊断：`INVALID_FILTER_RANGE`、`UNSUPPORTED_FILTER_OPERATOR`、`SORT_RANGE_CONFLICT`、`VIEW_REFERENCE_INVALID`。
- 比较器显式接收 locale，处理空白、错误和混合类型的固定顺序。
- 唯一值列表、筛选与排序支持 Worker 计算、取消、行数上限和内存预算。
- 自定义筛选表达式复用安全公式子集，不执行任意 JavaScript。

### 破坏性更新策略

将旧的行隐藏布尔值拆分为文档显式隐藏与视图派生隐藏；旧筛选状态不再直接写行模型。打印 API 必须显式接受视图，不隐式读取当前 React UI 状态。

### 实施阶段

1. 建立稳定类型比较器和多列排序 transaction。
2. 实现筛选描述符、可见性映射与表头 UX。
3. 加入 document/session Filter View 生命周期。
4. 接入模板打印、Table、Chart/Pivot 与 XLSX AutoFilter。

### 验收标准

- 多列排序稳定且一次撤销完整恢复全部引用和行数据。
- Filter 只改变派生可见性，不删除或移动数据。
- session 视图不产生文档 change event。
- 模板预览、浏览器打印和 PDF 对同一视图输出相同行集。
- XLSX 支持范围内的 AutoFilter 与排序状态可互操作。

### 依赖与已决决策

依赖类型化值、Formula Core、Command/Transaction；与 Structured Table、Chart、Pivot 和 Slicer 共用视图状态。

已决策：排序修改文档，筛选不修改数据；个人视图属于 session；打印视图必须显式选择。

---

## DATA-01 数据整理与清洗命令

**状态：planned**

### 产品目标与场景

为导入数据、名单整理和模板数据准备提供可预览、可撤销的批量工具，降低用户因一次错误操作损坏大量数据的风险。

### 范围与非目标

提供行列分组/折叠、删除重复、文本分列、查找替换、填充序列、增强自动填充，以及空白、错误和类型异常分析。首期只对当前文档数据执行确定性转换，不提供 ETL 管道调度、远程数据库写回或机器学习清洗。

### UX 与公开 API

- 每个破坏性数据工具先显示影响范围、样例变化、警告和预计单元格数。
- 用户确认后一次提交；结果提示更改数量并提供立即撤销。
- 超大任务显示进度并支持取消，取消不修改文档。

```ts
interface DataTransformPreview {
  affectedRange: CellRange;
  sampleChanges: CellChange[];
  warnings: Diagnostic[];
  estimatedCellCount: number;
  planId: string;
}

previewDataTransform(snapshot, request): Promise<DataTransformPreview>;
commitDataTransform(controller, planId): TransactionResult;
```

### 数据模型

转换请求与预览计划是临时不可变对象；文档只保存确认后的结果和分组定义。`planId` 绑定源 snapshot revision，源文档变化后计划失效。计划只包含可验证的规范化 Command，不暴露或持久化内部 Patch。

### 内部模块与数据流

```text
request + snapshot revision → TransformPlanner → preview + normalized CommandPlan
user confirmation + same revision → controller.transact(commandPlan.commands)
revision mismatch → discard plan and require regeneration
```

Worker 可生成仅包含公开 Command 的版本绑定 `CommandPlan`；DocumentController 在主线程重新验证 Command，并由受信任 handler 生成内部 Patch。引用和模板区域转换由结构命令层完成，数据工具不得自行改写公式字符串。

### 错误、性能与安全

- 稳定诊断：`TRANSFORM_PLAN_STALE`、`TRANSFORM_TOO_LARGE`、`TEXT_SPLIT_OVERFLOW`、`REPLACE_PATTERN_INVALID`、`GROUP_LIMIT_EXCEEDED`。
- 正则查找使用受控引擎或时间预算，防止灾难性回溯。
- 限制输入范围、生成 command 数和预览样例数；大任务分块计算并支持 `AbortSignal`。
- 公式注入、类型变化和覆盖非空目标在预览中作为显著警告。

### 破坏性更新策略

删除任何直接遍历并就地修改单元格的批量工具；全部改为 preview/plan/transaction。旧命令若不能生成确定逆补丁则不再公开。

### 实施阶段

1. 建立通用 TransformPlanner、revision 绑定和预览 UI。
2. 实现查找替换、文本分列、删除重复。
3. 实现填充序列、自动填充、分组折叠。
4. 加入异常分析、Worker 执行和模板区域冲突诊断。

### 验收标准

- 所有工具确认前不修改文档，确认后只产生一个可撤销 transaction。
- snapshot revision 变化后旧计划不能提交。
- 转换同步维护公式、验证、条件格式、Table 和模板/打印区域。
- 达到资源限制时安全终止并保留原文档。

### 依赖与已决决策

依赖 Workbook 2.0、Command/Transaction、Formula AST 引用转换、Worker 任务基础设施。

已决策：所有数据清洗必须先预览；Worker 只能规划规范化 Command，Patch 仅由主线程 controller 内部 handler 创建。

---

## IO-01 CSV、XLSX 与 ODS 文件互操作

**状态：planned**

### 产品目标与场景

让宿主应用可以安全导入常见表格文件、导出可交换文档，并对未支持能力提供可审计报告。XLSX 既是兼容基准，也是模板打印配置和语义化工作簿的主要交换格式。

### 范围与非目标

交付顺序为 CSV/TSV、XLSX、ODS。CSV/TSV 支持编码、分隔符、引号、换行、表头和 locale 配置；XLSX/ODS 支持项目已实现语义的导入与 round-trip。首期不执行宏、不刷新外部数据连接、不承诺未知 OOXML/ODS 节点无损保留，也不宣称完整 Excel round-trip。

### UX 与公开 API

- 导入向导展示检测到的格式、工作表、locale、公式/宏/外部链接风险和降级项，确认后才替换或插入文档。
- 导出面板选择格式、范围、公式策略与 CSV 注入保护；导出结果是 `Blob`。
- 宿主负责文件选择、上传、下载位置和权限。

```ts
interface WorkbookReader {
  readonly formats: string[];
  read(input: Blob | ArrayBuffer, options: ReadOptions): Promise<ImportResult>;
}

interface WorkbookWriter {
  readonly formats: string[];
  write(document: SpreadsheetDocument, options: WriteOptions): Promise<Blob>;
}

interface ImportResult {
  document: SpreadsheetDocument;
  diagnostics: Diagnostic[];
  unsupportedFeatures: UnsupportedFeature[];
  securityReport: ImportSecurityReport;
}
```

### 数据模型

Reader 解析为规范化 `SpreadsheetDocument`；Writer 只读取不可变 snapshot。导入结果记录源格式、解析版本和每个降级项的位置。XLSX 公式可保存源码与受信任级别明确的缓存值；宏、外部链接和嵌入对象仅进入安全报告，不进入可执行运行时。

### 内部模块与数据流

```text
bytes → container limits → parser Worker → source AST/model
      → semantic mapper → SpreadsheetDocument + diagnostics + security report
snapshot → format capability mapper → package writer → Blob
```

CSV 采用流式解码；XLSX/ODS 先检查压缩容器预算，再解析 XML，并通过 capability mapper 统一报告支持、降级和拒绝。

### 错误、性能与安全

- 稳定诊断：`UNSUPPORTED_FILE_FORMAT`、`ARCHIVE_LIMIT_EXCEEDED`、`XML_LIMIT_EXCEEDED`、`UNSUPPORTED_WORKBOOK_FEATURE`、`FORMULA_INJECTION_RISK`、`EXTERNAL_LINK_BLOCKED`、`MACRO_IGNORED`。
- XLSX/ODS 在 Worker 中解析，限制压缩包大小、解压总量、文件数、XML 深度、共享字符串数、图片字节数和总单元格数。
- 禁止解析 XML 外部实体；外部 URL 不自动请求；宏永不执行。
- CSV 导出默认防护以 `= + - @` 开头的文本，宿主必须显式关闭保护。

### 破坏性更新策略

建立新的 Reader/Writer adapter 契约，替换散落的格式转换函数。旧 JSON 或 CSV 导入 API 可直接删除；迁移文档说明新 API 和错误模型，不维持兼容重载。

### 实施阶段

1. 完成 CSV/TSV 流式 Reader/Writer、导入向导和注入保护。
2. 建立 XLSX capability matrix、容器安全层和核心单元格/样式/公式导入。
3. 扩展 XLSX 到验证、条件格式、Table、对象和完整打印设置。
4. 实现 ODS reader/writer 及跨软件验收套件。

### 验收标准

- CSV 编码、分隔符和换行处理有大文件与恶意公式用例。
- XLSX/ODS 超限或恶意输入在预算内失败，不阻塞主线程且不产生部分文档。
- 支持语义 round-trip 后保持值、公式、格式、合并、验证和打印配置。
- 每个未支持或降级能力均出现在导入/导出报告中。
- 生成的 XLSX 在 Excel Desktop、Excel for web 和 LibreOffice 中可打开并通过项目兼容矩阵。

### 依赖与已决决策

依赖 Workbook 2.0、Formula/Format Core、Resource Store、PrintProfile、Foundation 的最小 Adapter Registry Kernel 和 Worker 基础设施；Phase 4 公开 Adapter SDK 不是本项前置依赖。

已决策：XLSX 是主要互操作基准但只承诺能力矩阵内语义；未知特性不静默保留；解析器默认零网络、零宏执行；宿主负责文件生命周期。
