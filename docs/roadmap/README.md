# tego-sheet Roadmap

状态基线：2026-07-22

本 Roadmap 面向可嵌入业务系统的 React 电子表格组件与 TypeScript SDK。优先级表达能力依赖和建议实施顺序，不代表发布日期。

## Product direction

核心方向是电子表格模板打印与文档生成：业务用户在表格中设计模板，应用传入结构化数据，SDK 生成确定性的预览、指定区域浏览器打印、PDF、XLSX 和图片输出。

## Planned phases

| Phase | Capability | Status | Design |
| --- | --- | --- | --- |
| 0 | Workbook 2.0 typed document model | planned | [Foundation](foundation.md) |
| 0 | Atomic Command / Transaction | planned | [Foundation](foundation.md) |
| 0 | Formula dependency and number-format core | planned | [Foundation](foundation.md) |
| 0 | Shared render semantics and Canvas accessibility | planned | [Foundation](foundation.md) |
| 0 | Minimal cell-type and adapter registry kernel | planned | [Foundation](foundation.md) |
| 1 | Sheet, selection and range print targets | planned | [Template printing](template-printing.md) |
| 1 | Safe scalar bindings, repeat rows and conditional ranges | planned | [Template printing](template-printing.md) |
| 1 | Deterministic pagination and print profiles | planned | [Template printing](template-printing.md) |
| 1 | Page preview and isolated browser printing | planned | [Template printing](template-printing.md) |
| 2 | Nested, horizontal, range and page repeats | planned | [Template printing](template-printing.md) |
| 2 | Image, font, QR code and async resource pipeline | planned | [Template printing](template-printing.md) |
| 2 | PDF Blob output | planned | [Template printing](template-printing.md) |
| 2 | XLSX template output | planned | [Template printing](template-printing.md) |
| 2 | SVG and PNG page output | planned | [Template printing](template-printing.md) |
| 3 | Conditional formatting | planned | [Formulas and data](formulas-data.md) |
| 3 | Advanced validation, dropdown and checkbox cells | planned | [Formulas and data](formulas-data.md) |
| 3 | Expanded function library and cross-sheet references | planned | [Formulas and data](formulas-data.md) |
| 3 | Named ranges, array and spill formulas | planned | [Formulas and data](formulas-data.md) |
| 3 | Multi-column sort, conditional filter and saved views | planned | [Formulas and data](formulas-data.md) |
| 3 | Grouping, deduplication, text split and data cleanup | planned | [Formulas and data](formulas-data.md) |
| 3 | CSV/TSV, XLSX and ODS interchange | planned | [Formulas and data](formulas-data.md) |
| 3 | Structured tables and structured references | planned | [Analysis and visualization](analysis-visualization.md) |
| 3 | Charts and Sparklines | planned | [Analysis and visualization](analysis-visualization.md) |
| 3 | Images, shapes, text boxes and anchored objects | planned | [Analysis and visualization](analysis-visualization.md) |
| 3 | PivotTable and Slicer | planned | [Analysis and visualization](analysis-visualization.md) |
| 3 | Goal Seek and pluggable Solver | planned | [Analysis and visualization](analysis-visualization.md) |
| 4 | Public structured cell renderer/editor plugin SDK | planned | [Extensibility](extensibility.md) |
| 4 | Versioned Template Module SDK | planned | [Extensibility](extensibility.md) |
| 4 | Public adapter lifecycle, trust policy and compatibility SDK | planned | [Extensibility](extensibility.md) |
| 4 | Persistence and version history adapters | planned | [Host integrations](host-integrations.md) |
| 4 | Collaboration and remote selection adapters | planned | [Host integrations](host-integrations.md) |
| 4 | Permission and comment adapters | planned | [Host integrations](host-integrations.md) |
| 4 | Validated AI command proposals | planned | [Host integrations](host-integrations.md) |

## Maintenance rules

- 只将尚未交付的能力标为 `planned`。
- 能力完成并达到 Mini-RFC 验收标准后，移动到发布记录，不继续作为待办展示。
- Roadmap 项目必须链接到设计文档；没有技术和产品定义的想法不能进入主 Roadmap。
- Host integrations 只定义 SDK 协议和组件 UI 接入点，不承诺内建 SaaS 服务。
- 任何阶段调整必须同步更新总设计、Roadmap 索引和受影响 Mini-RFC。
