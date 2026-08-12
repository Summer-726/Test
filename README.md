# AI 经济顾问（微信小程序 · 测试版）

面向"没有独立收入的学生"的 AI 经济顾问，解决两个核心痛点：
- **无意识超支**——生活费在不知不觉中花超
- **花钱没换来相应的情绪回报**——钱花了却不一定开心

## 项目是什么

- 📄 **手动记账**：输一句话，AI 自动分类（6 类），可记账后选答两问评定"值不值"
- 💰 **三分预算**：生活费按比例分"日常 / 应急 / 存款"，日常 70%/90% 预警、跨月结转、可设存钱目标
- 💬 **带真实账本的 AI 顾问**：DeepSeek，随时问"该不该买 X""钱花哪了"
- 📊 **汇报与洞察**：今日 / 本月汇报（随时点）、月度回顾（月底自动）、分类图表 + AI 点评

## 技术栈

微信小程序前端（WXML / WXSS / JavaScript）+ 微信云开发·云函数（Node.js）+ DeepSeek API + 手机本地存储

## 文档索引

> 新会话（或新人）请按顺序读：先 README 了解项目，再读「会话交接」了解当前进度。

| 文档 | 内容 | 状态 |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | AI 工作指引：标准文件路径 + 工作说明 | 持续更新 |
| [docs/handoff.md](docs/handoff.md) | 当前进度、下一步、阻塞项（**新会话先读**） | 持续更新 |
| [docs/requirements.md](docs/requirements.md) | 需求分析与全部决策 | 已定稿（2026-08-10） |
| [docs/tech.md](docs/tech.md) | 技术方案（栈 / 数据 / AI 集成） | 已建立 |
| [docs/design.md](docs/design.md) | 设计规范（苹果风 UI） | 已建立 |
| [docs/development-plan.md](docs/development-plan.md) | 开发里程碑与执行步骤 | 已确认 |
| [docs/account-setup.md](docs/account-setup.md) | 用户本人的 4 步账号操作教程 | 阶段 0 使用 |
| [devlog/](devlog/) | 开发日志（每天：完成 + 待办） | 每天更新 |

## 当前状态

需求已定稿；文件结构已重组（docs/ 收纳标准文档 + devlog/ 开发日志 + CLAUDE.md 工作指引）。当前处于**阶段 4c（AI 多会话对话，待验证）**，详见 [docs/handoff.md](docs/handoff.md)。

## 目录结构

```
Test/
├── CLAUDE.md           AI 工作指引
├── README.md           本文件：项目入口
├── docs/               标准文档（需求/技术/设计/计划/交接/账号教程）
├── devlog/             开发日志（每天一个文件）
├── miniprogram/        小程序前端（阶段 1 创建）
├── cloudfunctions/     云函数（阶段 4 创建）
└── project.config.json 项目配置（阶段 1 创建）
```
