# Host Integrations Mini-RFCs

- 状态：`planned`
- 能力域：Host Integrations
- 产品定位：可嵌入业务系统的 React 电子表格组件与 TypeScript SDK。
- 核心边界：本项目定义本地状态机、UI 协议、事务与 adapter 接口；宿主负责账号、认证、服务端授权、数据存储、实时服务、通知、计费、审计基础设施和运维。

## SDK、Adapter 与 SaaS 的责任边界

| 能力 | SDK 负责 | Host Adapter 负责 | 宿主/SaaS 负责 |
| --- | --- | --- | --- |
| 持久化 | dirty/saving/saved/error 状态、快照、事务日志、冲突 UI | load/save/autosave 协议转换 | 数据库、对象存储、认证、加密、配额、备份 |
| 协作 | transaction 序列化、远程操作应用、presence UI、撤销协议 | connect/submit/subscribe/reconnect 桥接 | OT/CRDT、会话、排序、离线同步、权威状态 |
| 权限 | UI 禁用、提交前检查、权限目标模型 | 提供 revision snapshot | 身份、策略、服务端再授权、审计 |
| 评论 | 锚点、标记、面板、结构变换 | CRUD 与事件桥接 | 用户目录、@提及、通知、持久化、审核 |
| 版本历史 | 列表/差异/只读预览/恢复命令 | 版本读取与 checkpoint 协议 | 历史存储、保留策略、归因、合规 |
| AI | 上下文选择与脱敏入口、proposal 校验、dry-run、确认 | 调用模型并返回命令提案 | 模型、提示词服务、数据治理、额度与审计 |

任何 adapter 都不能把客户端检查当作服务端安全边界。组件在没有 Host Adapter 时仍必须支持核心编辑、模板设计、预览以及本地浏览器打印和已安装的本地输出 adapter。

---

## H1. Persistence Adapter

### 状态

`planned`

### 产品目标与用户场景

让宿主把电子表格文档可靠地保存到任意后端，同时为用户提供清晰的未保存、保存中、已保存、离线、冲突和失败状态。

典型场景：

- 业务系统按文档 ID 加载和保存模板。
- 用户连续编辑时自动保存，关闭页面前能看到未保存提示。
- 两个浏览器修改同一文档时，基于版本号识别冲突而非最后写入者静默覆盖。
- 宿主选择保存完整 snapshot、增量 transaction log 或两者组合。

### 范围与非目标

范围：

- `load`、`save`、可选 `autosave` 协议。
- dirty/saving/saved/offline/conflict/error 状态机。
- snapshot、transaction batch、base revision 与幂等 request ID。
- 保存重试、取消、冲突解析入口和离开页面保护。

非目标：

- SDK 不提供数据库、对象存储、账号、加密密钥或备份服务。
- SDK 不决定数据驻留、保留周期和合规策略。
- 不在文档 JSON 中保存认证 token 或连接信息。
- 不把 autosave 成功等同于服务端持久化，必须以 adapter ack 为准。

### 产品交互与公开 API

```ts
interface PersistenceAdapter {
  readonly manifest: AdapterManifest;
  load(documentId: string, signal: AbortSignal): Promise<LoadedDocument>;
  save(request: SaveRequest, signal: AbortSignal): Promise<SaveResult>;
  autosave?(request: SaveRequest, signal: AbortSignal): Promise<SaveResult>;
}

interface SaveRequest {
  documentId: string;
  requestId: string;
  baseRevision: string;
  snapshot?: SpreadsheetDocument;
  transactions: readonly SerializableTransaction[];
  reason: 'manual' | 'autosave' | 'checkpoint' | 'before-close';
}

type SaveResult =
  | { status: 'saved'; revision: string; persistedTransactionIds: readonly string[] }
  | { status: 'conflict'; currentRevision: string; remote?: SpreadsheetDocument }
  | { status: 'rejected'; code: string; message: string };

interface PersistenceController {
  readonly state: PersistenceState;
  save(reason?: SaveRequest['reason']): Promise<SaveResult>;
  retry(): Promise<SaveResult>;
  resolveConflict(resolution: ConflictResolution): Promise<SaveResult>;
}
```

产品 UI：

- 顶部状态显示“未保存 / 保存中 / 已保存 / 离线 / 保存失败 / 存在冲突”。
- 手动保存可立即触发；保存中继续编辑时，新 transaction 进入下一批，不篡改飞行中的请求。
- 关闭页面提示只在存在未确认持久化的 transaction 时出现。
- 冲突面板提供“查看远端差异、保留本地副本、载入远端、宿主提供的合并方案”；默认不自动覆盖。

### 数据模型

```ts
type PersistenceState =
  | { status: 'clean'; revision: string; savedAt: number }
  | { status: 'dirty'; revision: string; pending: readonly TransactionId[] }
  | { status: 'saving'; revision: string; requestId: string; inFlight: readonly TransactionId[]; pending: readonly TransactionId[] }
  | { status: 'offline'; revision: string; pending: readonly TransactionId[] }
  | { status: 'conflict'; baseRevision: string; currentRevision: string; pending: readonly TransactionId[] }
  | { status: 'error'; revision: string; pending: readonly TransactionId[]; diagnostic: Diagnostic };
```

`revision` 是宿主提供的不透明字符串。SDK 只比较相等性，不解析时间或序号。事务只有出现在 `persistedTransactionIds` 中才从 pending 移除。

### 内部模块与数据流

```text
Committed transaction
→ pending queue
→ autosave scheduler/manual save
→ immutable SaveRequest
→ adapter
→ saved: advance revision + acknowledge IDs
  conflict: freeze autosave + open resolver
  failure: retain queue + retry policy
```

内部模块：`persistence/state-machine`、`persistence/pending-queue`、`persistence/save-coordinator`、`persistence/conflict-session`、`persistence/react-bindings`。

### 错误、性能与安全

诊断码：`PERSISTENCE_LOAD_FAILED`、`PERSISTENCE_SAVE_FAILED`、`PERSISTENCE_CONFLICT`、`PERSISTENCE_REVISION_INVALID`、`PERSISTENCE_ACK_INVALID`、`PERSISTENCE_CANCELLED`。

- request ID 必须幂等；超时重试复用同一 request ID。
- 自动保存默认在最后一次提交 1 秒后触发，最大等待 10 秒；宿主可在 250 ms–60 s 范围调整。
- 单次请求默认最多 1,000 个 transaction 或 8 MiB 序列化负载，超过时分批。
- 保存 payload 不包含 adapter 凭证；错误消息进入 UI 前清除服务端堆栈与敏感字段。
- `beforeunload` 只做提示，不尝试依赖无法保证完成的异步保存。
- load 结果必须经过 schema 校验、迁移与资源限制后才能替换当前文档。

### 破坏性更新策略

- 新 controller 以 revision + pending transaction 为唯一保存模型，删除旧的任意 `onChange` 即保存契约。
- 受控组件仍可观察文档变化，但不能假定回调返回代表持久化成功。
- 保存协议变更通过 adapter `apiVersion` 管理；首个稳定版本前允许调整 request 结构，并同步更新契约测试。
- schema 迁移失败时拒绝载入，不保留旧模型的部分解析分支。

### 交付阶段

1. **H1.1 状态机**：pending queue、revision、手动保存和失败重试。
2. **H1.2 自动保存**：调度、批次隔离、离线状态和关闭提示。
3. **H1.3 冲突**：差异会话、三种基础决策和宿主合并入口。
4. **H1.4 加固**：幂等、限额、取消、schema 校验和故障注入测试。

### 验收标准

- 保存中继续编辑不会丢失或误确认新 transaction。
- 相同 request ID 重试不会产生重复版本。
- 冲突不会静默覆盖任一方，用户决策生成新的保存请求。
- adapter 失败或离线后 pending 队列完整保留，恢复后可继续保存。
- 未保存提示严格由未 ack transaction 驱动。
- load 的畸形、超限或不兼容文档不能替换当前有效文档。

### 依赖与已决决策

依赖：Workbook 2.0、SerializableTransaction、Adapter Registry、统一 Diagnostic、文档 diff。

已决决策：SDK 管状态和队列，宿主管存储；revision 不透明；冲突默认显式处理；服务端 ack 是唯一保存成功依据。

---

## H2. Collaboration Adapter

### 状态

`planned`

### 产品目标与用户场景

让宿主接入任意实时协作后端，并由组件展示远程光标、选区、在线用户及远程修改，同时保持本地 transaction 原子性和确定的失效引用诊断。

### 范围与非目标

范围：连接、提交、确认、订阅远程操作、presence、重连状态、远程操作应用边界和协作撤销协议。

非目标：SDK 不实现服务端会话、OT/CRDT 算法、消息总线、离线权威合并、用户身份或服务端顺序。首期不宣称脱离宿主算法即可多端协作。

### 产品交互与公开 API

```ts
interface CollaborationAdapter {
  readonly manifest: AdapterManifest;
  connect(context: CollaborationContext, signal: AbortSignal): Promise<CollaborationSession>;
}

interface CollaborationSession {
  readonly sessionId: string;
  submit(transaction: SerializableTransaction, signal: AbortSignal): Promise<CollaborationAck>;
  subscribe(listener: (event: CollaborationEvent) => void): Unsubscribe;
  updatePresence(presence: PresenceState): void;
  requestUndo?(transactionId: string, signal: AbortSignal): Promise<UndoProposal>;
  close(): Promise<void>;
}

type CollaborationEvent =
  | { type: 'operation'; operation: RemoteOperation }
  | { type: 'presence'; presence: readonly RemotePresence[] }
  | { type: 'connection'; state: ConnectionState }
  | { type: 'resync-required'; reason: string };
```

UI 展示连接状态、在线成员、远程选区与冲突诊断。断线时本地编辑策略由宿主配置为 `read-only` 或 `queue-local`；若选择后者，adapter 必须明确支持重放与重新基准化。

### 数据模型

```ts
interface RemoteOperation {
  operationId: string;
  actorId: string;
  baseRevision: string;
  revision: string;
  transaction: SerializableTransaction;
}

interface PresenceState {
  sheetId: SheetId;
  activeCell?: CellAddress;
  selections: readonly CellRange[];
  viewport?: CellRange;
}

interface RemotePresence extends PresenceState {
  actorId: string;
  display: { label: string; color: string };
  expiresAt: number;
}
```

actor ID 为不透明标识；头像、邮箱等资料不进入核心文档。远程 selection 是易失会话状态，不写入 Workbook。

### 内部模块与数据流

```text
Local transaction
→ collaboration outbox
→ adapter submit
→ ack/rebase/resync

Remote event
→ deduplicate operationId
→ revision/order validation
→ transform supplied by host protocol
→ permission check
→ atomic remote transaction apply
→ recalculation/render
```

模块：`collaboration/session-controller`、`collaboration/outbox`、`collaboration/remote-applier`、`collaboration/presence-store`、`collaboration/undo-coordinator`。

### 错误、性能与安全

诊断码：`COLLAB_CONNECT_FAILED`、`COLLAB_OPERATION_DUPLICATE`、`COLLAB_REVISION_GAP`、`COLLAB_REFERENCE_INVALID`、`COLLAB_REMOTE_REJECTED`、`COLLAB_RESYNC_REQUIRED`、`COLLAB_PRESENCE_INVALID`。

- operation ID 去重缓存至少覆盖当前会话与最近 10,000 条操作。
- presence 更新节流到最多每秒 10 次，过期状态自动移除。
- 远程 transaction 与本地 transaction 使用相同 schema、原子验证和资源上限。
- adapter 不得到权限凭证之外的宿主对象；远程显示文本进行长度和控制字符清理。
- revision 缺口、变换失败或未知结构引用触发 resync，不猜测应用。
- 大于 1 MiB 的单个远程操作被拒绝并要求 snapshot resync。

### 破坏性更新策略

- 协作直接建立在新 transaction 协议上，不适配旧的可变 workbook diff。
- 本地 undo 在协作会话中改为“请求逆向操作”，不承诺撤回历史世界状态；旧 undo 语义不保留。
- 首个稳定版只定义 adapter 边界，不绑定 OT 或 CRDT 数据结构。
- presence 协议可独立升级，不驱动文档 schema 版本。

### 交付阶段

1. **H2.1 会话与 presence**：连接状态、在线成员、远程选区和释放。
2. **H2.2 远程事务**：去重、顺序验证、原子应用和 resync。
3. **H2.3 本地 outbox**：ack、断线策略、重放能力协商。
4. **H2.4 协作撤销**：逆向操作请求、拒绝与 UI 反馈。

### 验收标准

- 重复、乱序、超限和非法远程操作不会产生部分状态。
- 远程选区不进入文档序列化，并在 session 关闭后完全释放。
- 断线策略明确可测；不支持重放的 adapter 不能启用 `queue-local`。
- revision 缺口稳定触发 resync，恢复 snapshot 后可继续会话。
- 多用户同时结构修改时，SDK 只应用宿主协议已转换且验证通过的 transaction。
- 协作模式 undo 不删除其他用户后续操作。

### 依赖与已决决策

依赖：SerializableTransaction、结构引用变换、Permission Snapshot、Persistence snapshot、Adapter Registry。

已决决策：宿主选择并实现 OT/CRDT；SDK 不猜测冲突合并；presence 为易失状态；协作撤销生成新操作。

---

## H3. Permission Adapter

### 状态

`planned`

### 产品目标与用户场景

让组件根据宿主授权结果正确隐藏或禁用查看、编辑、评论、打印、下载和模板绑定操作，并在命令提交边界再次检查，减少误操作和权限竞态。

### 范围与非目标

范围：revisioned permission snapshot、动作与目标模型、UI 查询、controller 提交检查和更新事件。

非目标：SDK 不认证用户、不计算组织策略、不签发 token、不替代服务端授权。客户端检查只用于产品行为和早期拒绝。

### 产品交互与公开 API

```ts
interface PermissionAdapter {
  readonly manifest: AdapterManifest;
  getSnapshot(context: PermissionContext, signal: AbortSignal): Promise<PermissionSnapshot>;
  subscribe?(listener: (snapshot: PermissionSnapshot) => void): Unsubscribe;
}

interface PermissionSnapshot {
  revision: string;
  actorId: string;
  can(action: PermissionAction, target: PermissionTarget): boolean;
}

type PermissionAction =
  | 'document:view' | 'document:edit'
  | 'sheet:view' | 'sheet:edit'
  | 'range:edit' | 'object:edit'
  | 'comment:view' | 'comment:create' | 'comment:resolve'
  | 'template:bind' | 'print' | 'download' | 'history:view' | 'history:restore';
```

被拒绝的工具按钮禁用并说明原因；快捷键、上下文菜单、API command 和 AI proposal 使用同一检查路径。用户权限变化时，当前编辑器先取消，再发布新 snapshot。

### 数据模型

```ts
type PermissionTarget =
  | { type: 'document'; documentId: string }
  | { type: 'sheet'; sheetId: SheetId }
  | { type: 'range'; range: CellRange }
  | { type: 'object'; sheetId: SheetId; objectId: ObjectId }
  | { type: 'comment'; threadId: string };

interface PermissionDecision {
  allowed: boolean;
  snapshotRevision: string;
  deniedTargets: readonly PermissionTarget[];
}
```

一次 command 涉及多个目标时必须全部允许；不做部分执行。

### 内部模块与数据流

```text
Permission snapshot
→ normalized immutable decision index
→ UI capability selectors

Command proposal
→ derive all targets
→ evaluate against one snapshot revision
→ allowed: validate + commit
  denied: reject whole command
→ host still authorizes save/remote submit
```

模块：`permissions/snapshot-store`、`permissions/target-derivation`、`permissions/command-guard`、`permissions/react-selectors`。

### 错误、性能与安全

诊断码：`PERMISSION_SNAPSHOT_INVALID`、`PERMISSION_DENIED`、`PERMISSION_REVISION_STALE`、`PERMISSION_TARGET_UNRESOLVED`。

- `can` 查询必须为同步纯函数；snapshot 更新以完整不可变对象原子替换。
- 未加载权限时默认 deny 受保护操作；只读文档展示可按宿主 bootstrap 配置开放。
- 范围检查使用规范化区间索引，单次命令最多检查 10,000 个离散目标，超限要求聚合范围。
- 服务端拒绝必须回传为持久化/协作失败，客户端不能伪造成功。
- 权限 snapshot 不包含角色秘密、策略源码或服务端凭证。

### 破坏性更新策略

- 所有 UI 和 command 权限判断迁移到统一 `PermissionAction`，删除散落的 `readOnly` 特判。
- 可保留 `readOnly` 作为宿主配置语法糖，但初始化时立即编译为 snapshot，不进入内部逻辑。
- 新增动作默认 deny，避免升级后意外开放。
- action 重命名属于主版本变更，并提供静态扫描迁移清单。

### 交付阶段

1. **H3.1 动作模型**：document/sheet/range/object 与 command target 推导。
2. **H3.2 UI 集成**：工具栏、菜单、快捷键、编辑器和打印下载入口。
3. **H3.3 动态更新**：revision snapshot、编辑会话取消和协作检查。
4. **H3.4 扩展动作**：评论、历史、模板与 AI proposal。

### 验收标准

- 同一拒绝规则对 UI、快捷键、公开 API 和 AI proposal 一致生效。
- 多目标 command 任一目标被拒绝时无部分提交。
- snapshot 原子更新，无逐规则异步竞态。
- 未加载或失效 snapshot 不会短暂开放编辑。
- print/download 权限分别控制，不因可查看文档而自动获得。
- 端到端契约明确证明服务端仍会再授权。

### 依赖与已决决策

依赖：Command target 推导、Adapter Registry、Comments、Version History、输出 adapter。

已决决策：客户端不是安全边界；完整 snapshot 原子替换；默认拒绝未知动作；命令权限不可部分通过。

---

## H4. Comments Adapter

### 状态

`planned`

### 产品目标与用户场景

让用户对单元格、区域和浮动对象发起讨论、回复和解决线程，并使锚点在插入、删除和移动结构后保持可解释的位置。

### 范围与非目标

范围：评论锚点模型、标记、面板、创建/回复/解决 UI、结构变换和打印策略。

非目标：SDK 不提供用户目录、头像存储、@提及搜索、通知发送、内容审核或评论数据库。

### 产品交互与公开 API

```ts
interface CommentAdapter {
  readonly manifest: AdapterManifest;
  list(documentId: string, signal: AbortSignal): Promise<readonly CommentThread[]>;
  create(input: CreateCommentInput, signal: AbortSignal): Promise<CommentThread>;
  reply(input: ReplyCommentInput, signal: AbortSignal): Promise<CommentThread>;
  setResolved(threadId: string, resolved: boolean, signal: AbortSignal): Promise<CommentThread>;
  queueAnchorUpdates(
    batch: CommentAnchorUpdateBatch,
    signal: AbortSignal,
  ): Promise<CommentAnchorUpdateAck>;
  resumeAnchorUpdates(
    documentId: string,
    documentRevision: string,
    signal: AbortSignal,
  ): Promise<readonly CommentAnchorUpdateBatch[]>;
  subscribe?(listener: (event: CommentEvent) => void): Unsubscribe;
}

interface CommentThread {
  id: string;
  anchor: CommentAnchor;
  messages: readonly CommentMessage[];
  resolved: boolean;
  revision: string;
  anchorDocumentRevision: string;
}

interface CommentAnchorUpdateBatch {
  operationId: string;
  documentId: string;
  fromDocumentRevision: string;
  toDocumentRevision: string;
  updates: readonly CommentAnchorUpdate[];
}

interface CommentAnchorUpdate {
  threadId: string;
  expectedThreadRevision: string;
  anchor: CommentAnchor;
}
```

产品 UI 包含单元格角标、选中锚点高亮、侧边评论面板、回复框和解决/重新打开操作。打印 profile 可选 `ignore`、`endnotes` 或 `markers-and-endnotes`；默认 `ignore`。

### 数据模型

```ts
type CommentAnchor =
  | { type: 'cell'; cell: CellAddress }
  | { type: 'range'; range: CellRange }
  | { type: 'object'; sheetId: SheetId; objectId: ObjectId }
  | { type: 'orphaned'; lastKnown: AnchorLocation; reason: string };

interface CommentMessage {
  id: string;
  authorId: string;
  body: CommentRichText;
  createdAt: string;
  editedAt?: string;
}
```

评论正文使用受限富文本 schema：段落、文本、链接和 mention token；不接受任意 HTML。mention token 仅保存 opaque actor ID 与显示快照。

### 内部模块与数据流

```text
Adapter list/events
→ schema sanitize
→ comment store
→ anchor index
→ canvas marker + side panel

Structural transaction
→ anchor transform
→ valid anchor or orphaned
→ revision-bound CommentAnchorUpdateBatch
→ durable idempotent adapter outbox
→ retry / conflict resync / acknowledgement
```

评论 CRUD 不直接进入 Workbook transaction；锚点结构变换作为文档 transaction 的派生 batch 交给 adapter。`operationId` 是幂等键，batch 同时绑定变换前后的 document revision 和 thread revision。Adapter 必须先把未确认 batch 写入可跨重载恢复的 outbox，再开始远程提交；加载文档时通过 `resumeAnchorUpdates` 恢复队列。若远端 revision 冲突，SDK 重新加载线程，基于仍可用的结构 transaction log 重新基准化；无法证明转换时将锚点标记为 stale/orphaned 并要求用户重新锚定。保存失败不回滚工作簿结构操作，但本地线程持续显示 sync error，直至确认或人工处理。

### 错误、性能与安全

诊断码：`COMMENT_LOAD_FAILED`、`COMMENT_WRITE_FAILED`、`COMMENT_REVISION_CONFLICT`、`COMMENT_ANCHOR_ORPHANED`、`COMMENT_BODY_INVALID`、`COMMENT_PERMISSION_DENIED`。

- 正文默认最大 20,000 字符、单线程 1,000 条消息。
- 链接协议仅允许 `https`、`http`、`mailto`，渲染时转义文本。
- 删除锚点目标时不静默删除评论，转换为 orphaned 并允许宿主归档或重新锚定。
- 列表虚拟化；画布只绘制可视区域角标。
- 并发回复和解决操作使用 thread revision，冲突后重新载入线程。

### 破坏性更新策略

- 评论不写入旧 Cell metadata 自由字段，统一使用外部线程与结构化锚点。
- 如现有批注数据存在，提供一次性导入转换；转换后不维持双写。
- 富文本 schema 与 adapter API 版本化，未知节点降级为纯文本而非执行。
- 锚点变换只依赖新 transaction 的结构 patch。

### 交付阶段

1. **H4.1 只读评论**：加载、角标、面板和锚点索引。
2. **H4.2 写操作**：创建、回复、解决、权限与 revision 冲突。
3. **H4.3 结构锚点**：插删移动、revision-bound 幂等 outbox、跨重载恢复、冲突重新基准化、orphaned 和重新锚定。
4. **H4.4 输出与实时**：打印尾注策略和 adapter 事件订阅。

### 验收标准

- 单元格、区域和对象评论可定位，滚动/冻结窗格下角标正确。
- 结构操作后锚点正确变换；被删除目标产生 orphaned，不丢线程。
- 提交锚点更新前刷新页面时，持久 outbox 能恢复并以同一 `operationId` 重试，不产生重复变换。
- 远端 thread/document revision 冲突会重新基准化或显式标记 stale，不能静默覆盖新锚点。
- 未授权用户不能通过 UI 或 API 创建、回复或解决。
- 恶意正文不能注入 HTML/脚本或危险链接。
- 打印三种策略输出确定，默认纸面不含评论。
- adapter 断线不阻塞工作簿编辑，并清楚显示评论同步失败。

### 依赖与已决决策

依赖：结构 patch/anchor transform、文档 revision 与 transaction log、Permission、Print Profile、Adapter Registry、宿主 actor resolver 和 adapter 持久 outbox。

已决决策：评论由宿主持久化；SDK 管锚点与 UI；锚点更新通过 revision-bound 幂等 outbox 恢复；删除目标不删除线程；正文采用受限富文本；打印默认忽略。

---

## H5. Version History Adapter

### 状态

`planned`

### 产品目标与用户场景

让用户浏览文档版本、查看结构化差异、只读预览旧版本并将旧版本内容恢复为新的当前版本，同时完整保留后续历史。

### 范围与非目标

范围：版本列表、分页、旧版加载、checkpoint、差异视图、恢复确认和恢复 transaction。

非目标：SDK 不保存历史、不制定保留策略、不做合规归档、不推断作者身份，也不删除或重写宿主历史。

### 产品交互与公开 API

```ts
interface VersionHistoryAdapter {
  readonly manifest: AdapterManifest;
  list(documentId: string, page: VersionPageRequest, signal: AbortSignal): Promise<VersionPage>;
  loadVersion(documentId: string, versionId: string, signal: AbortSignal): Promise<LoadedVersion>;
  createCheckpoint(input: CheckpointInput, signal: AbortSignal): Promise<DocumentVersion>;
}

interface DocumentVersion {
  id: string;
  revision: string;
  createdAt: string;
  actorId?: string;
  label?: string;
}

interface RestoreVersionCommand {
  type: 'restore-version';
  sourceVersionId: string;
  expectedCurrentRevision: string;
  replacement: SpreadsheetDocument;
}
```

历史面板按时间倒序分页。选择版本后进入只读预览，显示 sheet、cell、formula、style、template 与 print profile 的增删改摘要。恢复前展示影响统计并要求明确确认。

### 数据模型

```ts
interface DocumentDiff {
  fromVersion: string;
  toVersion: string;
  sheets: readonly SheetDiff[];
  summary: {
    cellsChanged: number;
    formulasChanged: number;
    structuralChanges: number;
    templatesChanged: number;
    printProfilesChanged: number;
  };
}
```

恢复不是“移动历史指针”，而是以旧 snapshot 为 replacement 创建新的 transaction/checkpoint。当前版本和被恢复版本都继续可访问。

### 内部模块与数据流

```text
History list
→ paged metadata store
→ load selected snapshot
→ schema validate/migrate
→ read-only controller
→ semantic diff against current

Restore confirm
→ permission + current revision check
→ RestoreVersionCommand
→ atomic replace
→ persistence save/checkpoint
```

模块：`history/version-store`、`history/read-only-session`、`history/semantic-diff`、`history/restore-command`。

### 错误、性能与安全

诊断码：`HISTORY_LIST_FAILED`、`HISTORY_VERSION_NOT_FOUND`、`HISTORY_VERSION_INVALID`、`HISTORY_DIFF_LIMIT_EXCEEDED`、`HISTORY_RESTORE_STALE`、`HISTORY_RESTORE_DENIED`。

- 列表每页最多 100 条。
- diff 在 Worker 中运行，默认最多比较 1,000,000 个已使用单元格；超限时仍返回 sheet/结构级摘要。
- 旧版本先 schema 校验与资源限制，再进入只读 controller。
- 历史预览禁用编辑、打印、下载和外部资源解析，除非权限分别允许。
- actor ID 不透明；显示名由宿主 resolver 提供且不写回历史对象。
- 恢复必须验证 `expectedCurrentRevision`，避免覆盖恢复期间的新修改。

### 破坏性更新策略

- 历史基于 Workbook 2.0 snapshot 与 transaction，不支持旧可变对象的逐字段 diff。
- 语义 diff 输出是版本化协议；首个稳定版前允许调整分类，但恢复语义固定为“创建新版本”。
- 不提供破坏性的“回滚并删除后续版本”API。
- schema 无法迁移的旧版本仍可下载原始数据由宿主处理，但 SDK 不做不完整预览。

### 交付阶段

1. **H5.1 列表与预览**：分页元数据、加载、校验和只读 session。
2. **H5.2 语义 diff**：单元格、结构、模板和打印配置摘要。
3. **H5.3 恢复**：权限、revision 检查、原子替换和 checkpoint。
4. **H5.4 大文档**：Worker、预算、渐进摘要和取消。

### 验收标准

- 旧版本预览不能修改当前文档，也不共享可变 controller。
- 恢复生成新版本，原当前版本与更早版本仍可列出。
- 恢复期间 current revision 变化会拒绝提交并要求重新比较。
- diff 对稳定 ID 的重命名/移动不会误报为删除后新建。
- 超大 diff 可取消并返回明确限制诊断，不阻塞编辑器主线程。
- history 权限对查看和恢复分别检查。

### 依赖与已决决策

依赖：Workbook 2.0、Persistence revision、Semantic Diff、Permission、Worker execution。

已决决策：宿主保存历史；SDK 负责预览和 diff；恢复总是创建新 transaction/checkpoint；不提供删除历史操作。

---

## H6. AI Command Adapter

### 状态

`planned`

### 产品目标与用户场景

让宿主接入 AI 服务，以自然语言提出格式化、公式、数据清理、模板绑定和分析操作建议，同时保证 AI 只能产生可验证、可预览、需确认的 command proposal，不能直接修改、打印、下载或外发文档。

### 范围与非目标

范围：上下文选择、脱敏接口、请求/响应 schema、proposal 校验、dry-run、权限检查、差异预览、明确确认与 transaction 提交。

非目标：SDK 不提供模型、不管理 API key、不决定提示词保留策略、不训练数据、不自动上传整个工作簿，也不允许 AI 绕过用户确认执行副作用。

### 产品交互与公开 API

```ts
interface AICommandAdapter {
  readonly manifest: AdapterManifest;
  propose(
    request: AIRequest,
    context: SanitizedDocumentContext,
    signal: AbortSignal,
  ): Promise<CommandProposal>;
}

interface AIRequest {
  instruction: string;
  selection: AIContextSelection;
  locale: string;
  allowedCommandTypes: readonly CommandType[];
}

interface CommandProposal {
  id: string;
  summary: string;
  assumptions: readonly string[];
  commands: readonly SerializableCommand[];
}

interface AIProposalSession {
  readonly proposal: CommandProposal;
  readonly preview: TransactionPreview;
  accept(): TransactionResult;
  reject(): void;
}
```

产品流程固定为：用户选择范围与数据类别 → 查看将发送的上下文摘要 → 发起请求 → 显示 proposal、假设、诊断和 dry-run 差异 → 用户明确点击应用 → 提交一个 transaction。结构变化导致 preview 过期时必须重新生成。

### 数据模型

```ts
interface AIContextSelection {
  ranges: readonly QualifiedRange[];
  include: readonly ('values' | 'formulas' | 'formats' | 'headers' | 'template-bindings')[];
  redactions: readonly RedactionRule[];
}

interface SanitizedDocumentContext {
  schemaVersion: 1;
  documentRevision: string;
  sheets: readonly SanitizedSheetContext[];
  omittedCellCount: number;
}

interface TransactionPreview {
  baseRevision: string;
  affectedRanges: readonly QualifiedRange[];
  changes: readonly PreviewChange[];
  diagnostics: readonly Diagnostic[];
}
```

上下文不包含评论、版本历史、权限策略、adapter 配置、资源凭证或未选择区域。公式可选择发送源码或仅发送结果；默认仅发送结果。

### 内部模块与数据流

```text
User selection + instruction
→ permission check
→ context projection
→ redaction + size limit
→ user-visible context summary
→ adapter propose
→ response schema validation
→ allowed-command filter
→ permission validation
→ dry-run on snapshot
→ diff/diagnostics
→ explicit accept
→ base revision recheck
→ one transaction
```

模块：`ai/context-projector`、`ai/redaction`、`ai/proposal-validator`、`ai/dry-run-session`、`ai/react-panel`。

### 错误、性能与安全

诊断码：`AI_CONTEXT_TOO_LARGE`、`AI_CONTEXT_PERMISSION_DENIED`、`AI_RESPONSE_INVALID`、`AI_COMMAND_NOT_ALLOWED`、`AI_PROPOSAL_UNSAFE`、`AI_PREVIEW_STALE`、`AI_REQUEST_FAILED`、`AI_REQUEST_CANCELLED`。

- 默认最多发送 10,000 个单元格或 1 MiB JSON；宿主可调低，不可超过核心 100,000 单元格硬上限。
- instruction 与模型输出均视为不可信数据；禁止把输出解释为 JavaScript、公式函数实现、DOM 或网络请求。
- proposal 只能包含公开 schema 中的 command，不能包含 print/download/save/collaboration-submit。
- 所有 command 先在不可变 snapshot 上 dry-run；error 诊断阻止应用。
- 用户接受时重新检查文档 revision 与权限；过期 proposal 不自动重放。
- adapter API key 由宿主闭包或服务端持有，不进入 `AIRequest`、日志或文档。
- 遥测默认只记录诊断码、耗时和大小，不记录指令、单元格值或模型输出。

### 破坏性更新策略

- AI 能力只基于新 command schema，不支持生成旧控制器方法调用。
- 可执行命令白名单随 SDK 版本发布；新增命令默认不自动授权给既有 adapter。
- proposal schema 主版本不兼容时拒绝响应，不尝试宽松解析。
- 任何早期“AI 直接操作 controller”接口在引入本协议时删除，不保留旁路。

### 交付阶段

1. **H6.1 安全上下文**：范围选择、投影、脱敏、大小限制和发送摘要。
2. **H6.2 Proposal 协议**：schema、白名单、权限与稳定诊断。
3. **H6.3 Dry-run UX**：差异、假设、错误定位、接受/拒绝和过期处理。
4. **H6.4 能力扩展**：依次开放格式、公式、数据清理和模板绑定命令，每类单独通过安全评审。

### 验收标准

- 默认请求不会包含未选择区域、评论、权限、凭证或版本历史。
- 非法、未知、越权和含副作用的命令在 dry-run 前被拒绝。
- AI 无法绕过确认直接提交；接受后只产生一个可撤销 transaction。
- proposal 生成后文档或权限变化会使其过期，不能应用旧 preview。
- 日志和异常中不出现单元格值、instruction、模型输出或 API key。
- 取消请求会终止 adapter 调用并释放 proposal session。
- 每种开放命令都有 hostile fixture，覆盖公式注入、超大范围、结构删除和隐藏数据访问。

### 依赖与已决决策

依赖：Command schema、Transaction dry-run、Permission、Adapter Registry、Diagnostic、范围投影与数据脱敏。

已决决策：AI 只提出命令；默认最小上下文；发送前用户可见；必须 dry-run 和明确确认；不授予打印、下载、保存或网络能力。

## 能力域交付顺序与完成定义

实施顺序为 `Permission → Persistence → Comments → Version History → Collaboration → AI Command`：权限先建立统一动作模型；持久化提供 revision；评论验证锚点协议；版本历史复用 snapshot/diff；协作最后接入事务与 revision；AI 在 command、权限和 dry-run 全部稳定后开放。

每个 Host Integration 只有在以下条件同时满足时才能从 `planned` 进入 `in-progress`：

- adapter 契约测试覆盖成功、拒绝、取消、超时、超限与释放。
- 没有 adapter 时核心组件仍通过编辑、模板、预览和本地输出测试。
- 客户端权限与服务端责任在示例集成中分别验证。
- 文档、类型、诊断码和迁移说明与实现同一变更交付。
