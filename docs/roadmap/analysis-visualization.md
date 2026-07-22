# 分析与可视化能力 Roadmap

本文定义结构化表格、图表、浮动对象、透视分析和求解工具的产品与技术方案。所有项目状态均为 `planned`。这些能力建立在 Workbook 2.0、公式/格式核心与 Command/Transaction 之上，并必须进入模板打印管线：编辑器、模板预览、浏览器打印、PDF 和 XLSX 输出读取同一快照与派生结果。

## 共同约束

- 产品保持组件/SDK 定位；后端计算、文件服务、用户身份与权限由宿主接入。
- 允许破坏性更新，不为未发布的旧对象模型或 API 保留并行实现。
- 分析结果属于可重建派生缓存；用户确认前，分析工具不得修改工作簿。
- 所有引用使用稳定 ID 和结构化引用，结构命令统一转换范围、公式和对象锚点。
- 屏幕、打印和 PDF 尽可能共享布局与矢量绘制语义；XLSX 输出优先保留原生表格语义。
- 长任务必须支持取消、进度、时间/内存预算和稳定诊断。

---

## TBL-01 结构化表格

**状态：planned**

### 产品目标与场景

让用户将普通区域升级为具有表头、命名列、样式、筛选、总计和自动扩展行为的数据实体，为公式、图表、Pivot 和模板重复区域提供稳定数据源。

### 范围与非目标

首期支持区域转表格、唯一名称、表头、列类型、样式、自动扩展、总计行、表格级排序筛选和 `Sales[Amount]` 结构化引用。Group-by View 作为派生视图后续加入。首期不提供数据库表、服务端查询、关系约束或跨工作簿 Table 引用。

### UX 与公开 API

- 用户框选区域后创建表格，可声明首行为表头并选择样式。
- 表头提供列名、类型、筛选排序和总计配置；拖动边界或在尾部录入可扩展表格。
- 模板模式可将 RepeatRows 的数据源绑定到 Table，并可视化显示边界控制权冲突。

```ts
interface TableDefinition {
  id: TableId;
  name: string;
  sheet: SheetId;
  range: CellRange;
  columns: TableColumn[];
  headerRows: number;
  totalsRow: boolean;
  style: TableStyle;
}

controller.execute({ type: 'table/create', sheet, range, options });
controller.execute({ type: 'table/resize', tableId, range });
```

### 数据模型

Table 以稳定 `TableId` 和 `ColumnId` 保存；名称只是用户可编辑标识。公式 AST 使用 ID 引用，显示和 XLSX 序列化时转换为结构化名称。表格行仍存储在工作表单元格中，Table 只定义结构、行为和样式层。

### 内部模块与数据流

```text
create/resize intent → TableValidator → structural transaction
    → range/reference transforms → formula dependency invalidation
TableDefinition + cells → TableView → filter/sort/chart/pivot/template source
```

紧邻表格底部的新行是否扩展由显式自动扩展策略决定，并通过 transaction 执行。模板绑定与 Table 边界由统一区域冲突检测器验证。

### 错误、性能与安全

- 稳定诊断：`TABLE_NAME_CONFLICT`、`TABLE_RANGE_OVERLAP`、`INVALID_TABLE_HEADER`、`TABLE_TEMPLATE_BOUNDARY_CONFLICT`、`STRUCTURED_REFERENCE_INVALID`。
- 名称经过规范化并防止伪装字符混淆；导出时按 XLSX 规则验证。
- 表格样式按区域层计算，不逐格复制；筛选与计算使用行索引。
- 自动扩展设有最大单元格预算，结构 transaction 失败时不得产生部分状态。

### 破坏性更新策略

用统一 TableDefinition 替换任何只在 UI 中存在的表头/筛选标记。结构化引用成为公式 AST 一等节点，不保留字符串模拟方案。

### 实施阶段

1. 建立 Table 模型、创建/调整/删除命令与样式层。
2. 接入结构化引用、自动扩展和总计行。
3. 接入排序筛选、模板 RepeatRows、Chart/Pivot 数据源。
4. 完成 XLSX 原生 Table 互操作与打印视觉回归。

### 验收标准

- 表格扩展、调整、重命名后结构化引用保持语义正确。
- Table 与其他 Table、模板结构绑定的非法重叠在提交前被拒绝。
- 排序筛选、打印和 XLSX 输出使用相同表格范围。
- 所有结构操作均可一次撤销并恢复公式、样式和元数据。

### 依赖与已决决策

依赖 Workbook 2.0、Formula AST、Command/Transaction、Sort/Filter View、CellPresentation。

已决策：Table 数据不复制到独立存储；AST 使用稳定 ID；模板重复区域和 Table 自动扩展不得同时控制同一边界。

---

## CHT-01 图表

**状态：planned**

### 产品目标与场景

提供可嵌入、可打印、可导出的常用业务图表，使报表模板能够把结构化数据转化为确定性的视觉输出。

### 范围与非目标

首期支持 Column、Bar、Line、Area、Pie、Scatter 和 Combo；支持标题、坐标轴、图例、数据标签、颜色、固定区域/Table 数据源和基础主题。首期不实现 3D 图表、地图、股票图、动画时间轴或完整 Excel 图表格式兼容。

### UX 与公开 API

- 用户选中数据后插入推荐图表，也可在属性面板切换类型、系列、轴、图例和样式。
- 图表作为可选择、移动和缩放的 SheetObject；无数据、错误数据或过期数据时显示明确状态。
- 模板模式中，位于重复区域的图表必须选择“每项复制”或“共享一次”。

```ts
interface ChartObject {
  id: ObjectId;
  type: ChartType;
  anchor: ObjectAnchor;
  series: ChartSeries[];
  axes: AxisConfiguration[];
  legend?: LegendConfiguration;
  style: ChartStyle;
  accessibility: { name: string; summary?: string };
}

chartRegistry.register({ type, validate, layout, paint, exportXlsx });
```

### 数据模型

图表保存规范化配置、稳定数据引用和对象锚点，不保存截图。布局结果、刻度、标签碰撞和绘制列表是以快照和字体度量为键的派生缓存。XLSX adapter 在能力可表达时生成原生 Chart。

### 内部模块与数据流

```text
Workbook snapshot + ChartObject → SeriesResolver → ChartDataSnapshot
→ ChartLayout(font metrics, locale) → VectorDisplayList
→ screen SVG/Canvas | PrintDocument | PDF | XLSX native chart
```

系列依赖注册到公式/区域依赖图，数据变化只使相关 ChartDataSnapshot 失效。打印模板在布局前冻结图表数据快照。

### 错误、性能与安全

- 稳定诊断：`CHART_SOURCE_INVALID`、`CHART_TOO_MANY_POINTS`、`CHART_LAYOUT_OVERFLOW`、`CHART_XLSX_DOWNGRADED`、`CHART_TEMPLATE_COPY_POLICY_REQUIRED`。
- 限制图表数、单系列点数、系列数和标签数；大数据使用抽样或拒绝策略，不能静默截断。
- 文本按普通字符串绘制，不解释 HTML/SVG；外部图片资源走 Resource Pipeline。
- 插件只接收不可变数据与 capability context，不得操作 React 树或 controller。

### 破坏性更新策略

移除依赖某个 UI 图表库内部配置的持久化格式，文档只保存项目规范化 ChartObject。旧截图式图表不迁移为可编辑图表，只能作为 ImageObject 导入并报告降级。

### 实施阶段

1. 建立 ChartObject、SeriesResolver、Anchor 与无障碍摘要。
2. 实现 Column/Bar/Line/Pie 的矢量 layout/paint。
3. 增加 Area/Scatter/Combo、属性面板和打印/PDF。
4. 增加 XLSX 原生图表导出、插件接口和兼容矩阵。

### 验收标准

- 数据变化只重算受影响系列，图表对象和文档修改可撤销。
- 相同数据快照和字体度量在预览、浏览器打印与 PDF 中保持几何一致。
- 每个图表具有可访问名称和文本摘要。
- XLSX 可表达图表以原生对象打开；降级项明确报告。

### 依赖与已决决策

依赖 Formula Core、Structured Table、Floating Object、Resource Pipeline、Print Display List、XLSX Adapter。

已决策：图表模型独立于具体 UI 库；打印/PDF 优先矢量；XLSX 优先原生对象；重复模板内必须声明复制策略。

---

## SPK-01 Sparklines

**状态：planned**

### 产品目标与场景

在单元格内以紧凑趋势图表达时间序列、对比和胜负结果，适用于高密度报表和模板打印。

### 范围与非目标

支持 line、column、win-loss，数据范围、空值/隐藏值策略、轴、负值、高低点和标记样式。首期不支持组合 Sparkline、多轴或任意脚本 renderer。

### UX 与公开 API

- 用户选择数据范围与目标区域创建 Sparkline，填充柄可按相对引用批量生成。
- 属性面板配置类型、颜色、标记和轴范围。
- 打印/PDF 中 Sparkline 作为单元格矢量内容，不改变单元格值或公式栏内容。

```ts
interface Sparkline {
  id: SparklineId;
  target: CellAddress;
  type: 'line' | 'column' | 'win-loss';
  source: RangeReference;
  options: SparklineOptions;
}
```

### 数据模型

Sparkline 属于工作表展示扩展集合，目标单元格保持原值。source 是结构化区域引用，复制、填充和结构命令按公式相对/绝对引用规则转换。

### 内部模块与数据流

```text
source values → SparklineDataResolver → normalized series
→ SparklineLayout(cell content box) → CellPresentation draw commands
```

它复用公式依赖图进行增量失效，复用条件格式可见性和 Print Display List 绘制基础设施。

### 错误、性能与安全

- 稳定诊断：`SPARKLINE_SOURCE_INVALID`、`SPARKLINE_EMPTY_SOURCE`、`SPARKLINE_POINT_LIMIT_EXCEEDED`。
- 限制每个 Sparkline 点数与每张表 Sparkline 数；同源范围共享规范化数据缓存。
- 文本和样式无脚本执行路径。

### 破坏性更新策略

不使用单元格自定义 HTML 或图片保存 Sparkline；现有类似展示扩展必须迁移为 Sparkline 模型或静态图片。

### 实施阶段

1. 完成 line 模型、引用转换、布局与打印。
2. 增加 column/win-loss、标记与轴策略。
3. 增加批量创建、填充、XLSX 互操作与性能优化。

### 验收标准

- 结构操作和复制填充后 source 引用正确。
- 屏幕、预览、打印与 PDF 使用相同规范化序列和几何。
- Sparkline 不改变单元格值，并能作为一个 transaction 创建或删除。

### 依赖与已决决策

依赖 Formula/Reference Core、CellPresentation、Print Display List、XLSX Adapter。

已决策：Sparkline 是单元格展示扩展，不是浮动图表，不占用独立 z-index。

---

## OBJ-01 浮动对象与锚点

**状态：planned**

### 产品目标与场景

用统一模型承载图片、形状、文本框和图表，使对象在行列变化、缩放、模板重复与多输出中保持可预测的位置和尺寸。

### 范围与非目标

支持绝对、一单元格、两单元格锚点，移动、缩放、旋转、层级、锁定，以及“固定位置”“随单元格移动”“随单元格移动并缩放”三类行为。首期不提供复杂矢量路径编辑、视频、嵌入网页或跨 Sheet 对象组。

### UX 与公开 API

- 插入对象后可拖动、缩放、旋转、调整层级和选择锚定行为。
- 对象选择框与单元格选区分离；键盘可移动和调整尺寸。
- 模板区域中的对象必须声明 `per-item`、`shared` 或 `forbidden` 重复策略。

```ts
type ObjectAnchor =
  | { type: 'absolute'; rect: Rect }
  | { type: 'one-cell'; cell: CellAddress; offset: Point; size: Size }
  | { type: 'two-cell'; from: CellAnchor; to: CellAnchor };

interface SheetObject {
  id: ObjectId;
  kind: 'image' | 'shape' | 'text-box' | 'chart';
  anchor: ObjectAnchor;
  zIndex: number;
  locked: boolean;
  templateRepeat: 'per-item' | 'shared' | 'forbidden';
}
```

### 数据模型

对象内容与锚点分离；图片只保存 ResourceRef。位置以逻辑 Sheet 坐标表达，不保存 viewport 像素。z-index 在工作表对象集合内规范化，稳定 ID 用于评论、权限和模板引用。

### 内部模块与数据流

```text
SheetObject + row/column geometry → AnchorResolver → logical rect
→ object-specific layout/paint → screen/print/PDF display list
structural command → AnchorTransformer → atomic object patches
```

模板展开先复制/共享对象，再转换锚点；资源解析在分页前完成。

### 错误、性能与安全

- 稳定诊断：`OBJECT_ANCHOR_INVALID`、`OBJECT_RESOURCE_MISSING`、`OBJECT_REPEAT_POLICY_REQUIRED`、`OBJECT_LIMIT_EXCEEDED`。
- 图片与 SVG 受 Resource Pipeline 的 MIME、大小、像素、清理和网络策略约束。
- 只渲染 viewport/页面相交对象；对象数量和单资源大小受预算限制。
- 文本框不支持任意 HTML；链接需按宿主 URL 安全策略处理。

### 破坏性更新策略

统一替换图片、图表等各自独立的位置字段。旧对象导入时必须转换到明确锚点；无法判断行为时选择 absolute 并产生迁移诊断。

### 实施阶段

1. 建立统一 Object/Anchor 模型和结构转换。
2. 实现图片、形状、文本框的编辑与 display list。
3. 接入图表、模板重复、资源管线和打印/PDF。
4. 完成 XLSX Drawing 锚点互操作与可访问性。

### 验收标准

- 插入/删除/调整行列后，各锚点模式符合定义并可撤销。
- 相同几何输入在屏幕、打印和 PDF 中保持位置与层级。
- 模板重复对象严格遵循声明策略，未声明时编译失败。
- 缺失或危险资源以诊断和安全占位呈现，不执行外部内容。

### 依赖与已决决策

依赖 Workbook 2.0、Command/Transaction、Resource Pipeline、Print Display List。

已决策：所有浮动元素共用锚点模型；文档保存逻辑坐标；模板内对象必须显式选择重复策略。

---

## PVT-01 PivotTable

**状态：planned**

### 产品目标与场景

允许用户无需编写公式即可按维度汇总大表，并把已刷新、可追踪的数据快照用于图表和模板打印。

### 范围与非目标

支持将字段拖入 Rows、Columns、Values、Filters，SUM、COUNT、AVERAGE、MIN、MAX，排序、筛选、小计、总计、展开折叠、刷新和双击查看源行。第二阶段支持计算字段。首期不提供 OLAP、多工作簿数据模型、实时数据库连接或 Excel Data Model 兼容。

### UX 与公开 API

- 字段面板支持拖拽区、聚合选择、字段排序和过滤。
- Pivot 输出区域只读；刷新期间保留旧结果并显示状态。
- 源数据变化后显示 stale 标记；打印前若仍 stale，按 profile 选择阻止输出或带 warning 使用旧快照。

```ts
interface PivotDefinition {
  id: PivotId;
  source: RangeReference | TableReference;
  rows: PivotField[];
  columns: PivotField[];
  values: PivotValueField[];
  filters: PivotFilter[];
  destination: CellAddress;
}

refreshPivot(snapshot, definition, { signal, limits }): Promise<PivotResult>;
```

### 数据模型

文档保存 PivotDefinition 和最近成功结果的 cache metadata；`PivotResult` 是不可变派生缓存，不把每个输出单元格写成普通用户数据。输出占用区域由 runtime reservation 管理，禁止用户直接编辑。

### 内部模块与数据流

```text
source snapshot → field typing → grouping/aggregation Worker
→ immutable PivotResult → output grid projection
→ CellPresentation / Chart / Slicer / PrintDocument
```

刷新成功后原子替换缓存引用；失败或取消时保留旧结果并标记 stale。双击明细从结果单元格的 lineage 索引映射回源行。

### 错误、性能与安全

- 稳定诊断：`PIVOT_SOURCE_INVALID`、`PIVOT_OUTPUT_OVERLAP`、`PIVOT_CARDINALITY_LIMIT`、`PIVOT_STALE`、`PIVOT_REFRESH_CANCELLED`。
- 限制源行数、字段基数、结果单元格和聚合内存；Worker 分块聚合并支持取消。
- 自定义聚合通过受控注册表，不执行任意表达式；明细查看遵守宿主权限过滤后的快照。
- 输出区域冲突在刷新前检测，不覆盖普通单元格或模板绑定。

### 破坏性更新策略

不以公式填充或复制单元格方式模拟 Pivot。若存在旧聚合表，仅作为普通数据保留，不能自动宣称为 PivotDefinition。

### 实施阶段

1. 建立 PivotDefinition、字段识别和基础聚合 Worker。
2. 实现只读结果投影、刷新/stale 状态、小计总计。
3. 增加筛选、排序、展开折叠、明细 lineage 与 Slicer。
4. 增加计算字段、Chart、打印和 XLSX Pivot 降级/互操作策略。

### 验收标准

- 相同源快照与定义生成确定顺序和结果。
- 刷新失败或取消不丢失最后成功结果。
- 用户不能编辑输出区域，输出冲突不会覆盖文档数据。
- 打印/PDF/XLSX 使用明确的 Pivot revision，并对 stale 状态产生约定行为。

### 依赖与已决决策

依赖 Structured Table、Formula typed values、Filter View、Worker 基础设施、PrintDocument。

已决策：Pivot 输出是派生缓存；刷新原子替换；打印默认要求最新结果；首期不绑定具体服务端分析引擎。

---

## SLC-01 Slicer

**状态：planned**

### 产品目标与场景

通过可视化筛选控件同时控制 Table、Pivot 和关联图表，使交互分析与模板输出共享明确的筛选状态。

### 范围与非目标

支持单字段离散值、单选/多选、清除筛选、搜索、目标绑定和 document/session 两种状态。首期不提供日期 Timeline、多字段组合控件或服务端查询 Slicer。

### UX 与公开 API

- 用户从 Table/Pivot 字段插入 Slicer，并在属性面板选择目标对象。
- 控件显示已选、未选、无数据状态，支持键盘与屏幕阅读器。
- 打印默认只应用筛选、不打印控件；`PrintProfile` 可输出静态筛选摘要。

```ts
interface Slicer {
  id: SlicerId;
  field: FieldReference;
  targets: Array<TableId | PivotId | ChartId>;
  selection: SlicerSelection;
  stateScope: 'document' | 'session';
  anchor: ObjectAnchor;
}
```

### 数据模型

Slicer 定义和 document selection 序列化；session selection 由宿主持有。字段引用使用稳定 ColumnId/PivotFieldId，目标引用使用稳定对象 ID。筛选结果复用统一 View Filter Predicate。

### 内部模块与数据流

```text
Slicer selection → predicate compiler → shared FilterContext
→ Table RowVisibilityMap | Pivot refresh/view | Chart data snapshot
→ template render and print
```

多个 Slicer 按 AND 组合，同一字段内的多选按 OR 组合；组合顺序和空选择语义固定。

### 错误、性能与安全

- 稳定诊断：`SLICER_FIELD_INVALID`、`SLICER_TARGET_INCOMPATIBLE`、`SLICER_VALUE_LIMIT`、`SLICER_TARGET_MISSING`。
- 唯一值枚举支持缓存、分页和上限；大基数字段拒绝创建并建议普通筛选。
- Slicer 只产生结构化 predicate，不接受脚本。
- session selection 不写入共享文档，避免意外影响协作者。

### 破坏性更新策略

统一复用 FilterContext，不为 Table、Pivot、Chart 分别保存无法同步的筛选状态。旧对象级临时筛选迁移为 session view，不自动写入文档。

### 实施阶段

1. 建立 Slicer 模型、字段值索引和 Table 目标。
2. 增加 Pivot/Chart 多目标、组合 predicate。
3. 增加 Floating Object UX、可访问性和静态打印摘要。
4. 完成 XLSX Slicer 能力评估；不支持时输出明确降级报告。

### 验收标准

- 同一 Slicer 对所有目标应用完全相同的筛选选择。
- document/session 状态边界明确，session 操作不触发文档变更。
- 多 Slicer 组合、空选择和缺失值行为具有固定测试。
- 模板预览、浏览器打印和 PDF 使用相同 FilterContext。

### 依赖与已决决策

依赖 Structured Table、Pivot、Chart、Filter View、Floating Object。

已决策：Slicer 是共享 FilterContext 的可视控制器；默认打印筛选结果而非交互控件；高基数字段不强行渲染全部值。

---

## GSK-01 Goal Seek

**状态：planned**

### 产品目标与场景

让用户指定公式目标值和一个可变单元格，计算满足目标的候选输入，适用于预算、报价、盈亏平衡和模板参数反推。

### 范围与非目标

首期支持单目标、单变量的连续数值求解，配置容差、最大迭代、变量上下界和初始值。首期不支持多变量、整数约束、不连续函数全局最优或自动提交结果。

### UX 与公开 API

- 对话框选择公式单元格、目标值、变量单元格和边界。
- 运行期间显示迭代、当前误差和取消入口；结束后预览候选值、误差和收敛状态。
- 用户明确确认后，用一个 transaction 写入变量值；取消或关闭不修改文档。

```ts
interface GoalSeekRequest {
  formulaCell: CellAddress;
  targetValue: number;
  variableCell: CellAddress;
  tolerance: number;
  maxIterations: number;
  bounds?: { min?: number; max?: number };
}

goalSeek(snapshot, request, { signal }): Promise<GoalSeekResult>;
```

### 数据模型

请求和结果属于 session，不序列化到 Workbook。结果记录源 snapshot revision、候选值、最终误差、迭代次数、状态和诊断；确认时 revision 必须一致。

### 内部模块与数据流

```text
snapshot + request → dependency validation → isolated calculation context
→ bracket/search + root iteration → GoalSeekResult
→ user confirm + revision check → one cell transaction
```

每次迭代只重算变量单元格的传递依赖，不能克隆并全量重算整个工作簿。

### 错误、性能与安全

- 状态固定为 `converged`、`not-converged`、`invalid-model`、`out-of-bounds`、`cancelled`。
- 稳定诊断：`GOAL_FORMULA_REQUIRED`、`GOAL_VARIABLE_NOT_NUMERIC`、`GOAL_NO_DEPENDENCY`、`GOAL_VOLATILE_FUNCTION`、`GOAL_RESULT_STALE`。
- 默认拒绝异步、易变、循环和错误公式；限制迭代次数、计算步数和运行时间。
- 在隔离快照上运行，禁止中间值触发 change event、外部 resolver 或打印副作用。

### 破坏性更新策略

Goal Seek 只依赖新的隔离计算上下文，不兼容直接临时修改 controller 再回滚的实现；此类 API 直接删除。

### 实施阶段

1. 建立模型验证、隔离计算上下文和二分/割线基础算法。
2. 实现 UX、进度取消、边界与 revision 防护。
3. 增加数值稳定性测试、模板参数预览集成和性能优化。

### 验收标准

- 用户确认前 Workbook revision 和 change events 均不变化。
- 收敛结果满足容差，非收敛原因明确且可复现。
- 确认时源 revision 变化会拒绝提交并要求重算。
- 大模型在预算内取消或终止，不阻塞编辑器。

### 依赖与已决决策

依赖 Formula Engine 增量计算、类型化值、Command/Transaction、Worker/Task 取消基础设施。

已决策：只做单变量确定性求解；结果是建议；易变和异步公式默认拒绝；模板可用其结果但不在打印期间隐式求解。

---

## SLV-01 Solver 可选模块

**状态：planned**

### 产品目标与场景

为优化排产、配比、预算和资源配置提供多变量、有约束的求解能力，同时避免将大型算法依赖绑入核心 Spreadsheet SDK。

### 范围与非目标

通过 adapter 支持线性、整数和非线性求解器；请求包含目标、变量、约束和算法选项。核心负责模型校验、快照、结果预览与 transaction 提交。首期不承诺全局最优、不内建云求解服务、不在文档打开或打印时自动运行。

### UX 与公开 API

- Solver 面板选择目标单元格、最大化/最小化/指定值、变量区域、约束和求解器。
- 运行显示进度、最佳候选、界限/误差和取消入口。
- 结果以单元格变更预览呈现；用户可应用、保留报告或放弃。

```ts
interface SolverRequest {
  objective: Objective;
  variables: CellAddress[];
  constraints: SolverConstraint[];
  options: SolverOptions;
}

interface SolverAdapter {
  manifest: AdapterManifest;
  supports(problem: SolverProblemClass): boolean;
  solve(model: CompiledSolverModel, context: SolverContext): Promise<SolverResult>;
}
```

### 数据模型

Solver 配置可选择保存为文档分析定义，但运行结果默认属于 session。结果包含源 revision、候选变量、目标值、约束残差、状态、耗时和 solver manifest/version。应用结果产生一个原子 transaction。

### 内部模块与数据流

```text
request + snapshot → model validator/classifier → CompiledSolverModel
→ selected adapter in Worker → SolverResult + diagnostics
→ dry-run formula recalculation → change preview
→ user confirmation + revision check → atomic transaction
```

核心把公式依赖投影为求解模型；adapter 无权访问 DocumentController 或未声明资源。

### 错误、性能与安全

- 状态固定为 `optimal`、`feasible`、`infeasible`、`unbounded`、`timeout`、`cancelled`、`error`。
- 稳定诊断：`SOLVER_ADAPTER_MISSING`、`SOLVER_MODEL_UNSUPPORTED`、`SOLVER_CONSTRAINT_INVALID`、`SOLVER_RESULT_STALE`、`SOLVER_LIMIT_EXCEEDED`。
- adapter 运行在 Worker，受变量数、约束数、时间、内存和迭代预算限制；支持 `AbortSignal`。
- 插件 manifest 声明许可证信息、算法类别和环境能力；依赖选择必须完成体积、维护、安全与许可证评估。
- 求解器不能执行网络请求或回写文档，除非未来 capability 明确授权；首期不给此授权。

### 破坏性更新策略

Solver 不进入核心 bundle，统一通过 Adapter Registry 装载。任何实验性内联求解 API 将被删除；文档保存的是规范模型，不保存第三方库私有对象。

### 实施阶段

1. 定义 Solver Problem IR、校验器、状态和 Adapter 契约。
2. 完成线性求解器依赖评估并实现首个可选 adapter。
3. 实现预览/确认 UX、Worker 预算和线性/整数验收集。
4. 增加非线性 adapter 接口、报告导出和模板场景集成。

### 验收标准

- 未安装 adapter 时核心仍可完整工作，并返回可操作诊断。
- 每种结果状态可稳定复现并包含约束残差或失败原因。
- 求解期间和用户确认前文档不变化；revision 变化拒绝旧结果。
- adapter 超时、崩溃或取消不会污染文档或阻塞后续求解。
- 应用候选值只产生一个可完整撤销的 transaction。

### 依赖与已决决策

依赖 Formula Engine、Command/Transaction、Foundation 的最小 Adapter Registry Kernel、Worker 基础设施；Phase 4 公开 Adapter SDK 不是前置依赖。具体算法库另行进行正式依赖评估。

已决策：Solver 是可选模块；核心只定义稳定 IR 与结果契约；用户明确确认后才修改文档；不在模板打印过程中隐式运行。
