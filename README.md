# 桃花源码 · 一步步走进代码的桃花源

> 「桃花源码」是一个陪练式编程学习 Agent：像一位坐在旁边的老师，先告诉你这一步写什么，你写完，老师再讲解这块是什么、为什么，然后基于它带你写下一块——**初极狭，后豁然开朗**。

面向「AI 代写导致黑盒化」问题：Copilot 们帮你写，桃花源码陪你**自己想出来**。

## 教学理念（本产品的骨架）

- **老师主导的引导循环**：每一步 = 老师给清晰指令（对话框）→ 学生写代码 → 运行自测（`通过: true`）→ 老师讲解这一段是什么、为什么 → 引出下一步。
- **一块块完善**：项目按模块分解成 2-3 步，后一步复用前一步的成果，让学生感受到「程序是一块块搭起来的」。
- **讲解在对话框里实时进行**，代码区保持干净（只有一行 TODO 提示），新手不会被注释淹没。
- **不代写**：卡壳时按 L1 方向 → L2 定位 → L3 伪代码逐级提示，绝不直接给答案；提交时还有防作弊审核。

## 快速开始

```bash
npm install          # 如遇 EPERM 安装错误：npm install --ignore-scripts
npm run dev          # 启动后打开 http://localhost:8787
```

### 模型配置

复制 `.env.example` 为 `.env`，填入任意 **OpenAI 兼容** 服务（智谱 / DeepSeek / 通义 / OpenAI 等）。当前仓库自带的 `.env` 已配置智谱 `glm-4-flash`（免费、非推理模型，支持流式）。

| 模式 | 触发条件 | 说明 |
|---|---|---|
| **AI 在线模式** | 配置 `LLM_API_KEY` | 计划生成、提示、对话全部走真实模型 |
| **离线演示模式** | 未配置 Key | 内置确定性规则兜底，不依赖网络即可完整演示 |

智谱示例：`LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4`、`LLM_MODEL=glm-4-flash`。
DeepSeek 示例：`LLM_BASE_URL=https://api.deepseek.com/v1`、`LLM_MODEL=deepseek-chat`。

> 注意：`glm-4.5-flash` / `glm-4.5-air` 等推理模型会把思考放在 `reasoning_content` 而不是正文，本项目**不推荐**使用推理模型（思考内容可能泄露答案且延迟高）。不建议在公开仓库中提交 `.env`（已加入 .gitignore）。

### 冒烟测试（端到端，支持两种模式）

```bash
# 先启动服务，再另开终端：
node scripts/smoke.mjs
```

覆盖：健康检查 → 建会话 → 计划 → 提示 → 运行 → 验收（失败/通过）→ 推进 → 对话 → **流式对话**，以及「参考实现不下发客户端」安全检查。

### 备课速度（已优化）

- 全新需求：实测约 **9~15 秒**（精简 prompt + 2200 max_tokens + 定向修复）；
- 相同需求第二次：**0 秒**（计划缓存写入 `data/plans.db`，演示时可秒开）；
- 总时间预算 120 秒，超时自动回退内置模板，用户等待有上限。

### 部署与比赛交付

见 **[DEPLOY.md](DEPLOY.md)**：**免费方案（Hugging Face Spaces，无需云服务器）** + Docker 部署 + Render，以及比赛三件套（PPT / 6 分钟视频 / 智能体链接）的提交检查清单。仓库已提供 `Dockerfile`，PPT 内容草稿见 `docs/PPT.md`。

---

## 核心能力

- **教学计划**：AI 按学生的需求生成 2-3 步项目；每步含起始代码（TODO + 自测）、验收标准、分级提示、教师端参考实现。
- **老师手把手引导**：创建项目即有老师开场（项目名 + 第一步指令）；每步提交通过后，老师讲解「这块是什么」并直接给出下一步指令——讲解全部在对话框，代码区保持干净。
- **历史学习**：所有项目保存于 SQLite，启动页可「继续学习」之前未完成的项目。
- **知识库**：每完成一步自动沉淀一张知识卡片（标题 + 一句话讲解），启动页/完成页可查看。
- **桃花源进入动画**：新建项目时播放「初极狭，后豁然开朗」的进入动画，可点击跳过。
- **质量闸门**：LLM 计划必须通过「参考实现能跑通验收 + 起始代码能运行 + 起始代码不能假通过」才被采用；不合格自动**定向修复**（只重写坏的任务），仍不合格回退内置模板（任何情况下都有可用计划）。
- **实时卡壳检测**：每 8 秒上报编辑活动（停顿、连续失败），命中阈值后自动推送提示；手动求助直接升一级。
- **提示阶梯**：L1 方向 → L2 定位 → L3 伪代码，自动提示封顶 L3，**绝不代写**。
- **防作弊审核**：提交时除了跑代码验收，还会用模型审核「代码是真的实现了逻辑，还是直接打印结果」，直接打印会被打回。
- **流式对话**：导师回复逐字输出（SSE），打字机效果。
- **持久化与恢复**：SQLite 存储会话（内置 `node:sqlite`，零原生依赖），刷新页面/重启服务都不丢；浏览器端 localStorage 记住会话与每步代码。
- **代码运行**：JavaScript 用 `node:vm` 沙箱（2s 超时）、Python 用子进程（3s 超时，强制 UTF-8 输出）。
- **界面**：学习路线条（✓ 进行中 ● 未完成 ○）、步骤进度、运行控制台、错误提示与重试。

## 架构分层（代码即文档）

```
src/
├── shared/                     ← 前后端唯一事实来源
│   ├── types.ts                  核心类型（TaskNode / ProjectPlan / SessionState / HintOutcome…）
│   └── hint-ladder.ts            提示阶梯常量与升级规则
│
├── server/
│   ├── index.ts                入口：装配依赖 → 挂 API → 挂前端（dev: Vite 中间件 / prod: 静态）
│   ├── env.ts                  配置 + 极简 .env 加载
│   ├── web-host.ts             前端托管（开发热更新 / 生产静态）
│   ├── errors.ts               HttpError
│   ├── api/
│   │   └── app.ts              全部 REST 路由（含 SSE 流式对话）
│   ├── domain/                 ← 领域层（纯业务，无 HTTP/无 IO 细节）
│   │   ├── tutor.ts              TutorService：会话、对话、提示阶梯、验收推进、防作弊审核
│   │   ├── plan.ts               PlanService：LLM 生成计划（XML+CDATA）→ 解析 → 质量闸门 → 定向修复 → 兜底
│   │   ├── fallback-plans.ts     内置教学模板（待办/计算器/Python 词频/自由项目）
│   │   └── stall.ts              卡壳检测（编辑快照 → 可解释信号）
│   └── infra/                  ← 基础设施（可替换实现）
│       ├── llm/provider.ts       LLM 抽象（chat / chatStream / chatJSON）
│       ├── llm/openai-compatible.ts  兼容实现（重试、JSON 模式回退、SSE 流式）
│       ├── runner.ts             代码运行器：JS 用 node:vm，Python 用子进程（强制 UTF-8）
│       └── store.ts              会话存储抽象：SQLite（node:sqlite）/ 内存降级
│
└── web/                        ← 前端（React 18 + CodeMirror 6）
    ├── App.tsx                  状态编排：活动上报、流式渲染、localStorage 恢复
    ├── api.ts                   API 客户端（含 SSE 解析）
    ├── styles.css
    └── components/              StartScreen / ChatPanel / PlanBar / TaskHeader / EditorPanel / RunOutput / FinishPanel
```

**依赖方向**：`web → shared`；`api → domain → infra`；`domain` 只依赖 `shared` 与抽象接口。替换任何基础设施（LLM、运行器、存储）都不需要改领域层。

## 一条请求的完整链路

```
创建会话   POST /api/sessions {goal}
          └─ PlanService：LLM 生成（XML/CDATA）→ 解析 → 质量闸门（实跑校验）
          └─ 不合格：定向修复（≤4 次）→ 仍不合格 → 内置模板兜底
          └─ 返回客户端时剥离 reference（教师端参考实现永不下发）

学生写码   编辑器 onChange → 记录编辑次数/最后编辑时间/连续失败，localStorage 自动保存
          └─ 每 8s 上报 POST /api/sessions/:id/activity

卡壳检测   idleMs 过久 或 连续运行失败 ≥3 → 触发
          └─ 提示阶梯升级 L1→L2→L3（自动封顶 L3，60s 冷却防刷屏）

运行代码   POST /api/sessions/:id/run → 沙箱执行 → stdout/stderr 展示

提交验收   POST /api/sessions/:id/complete → 重跑代码 + 验收 + 防作弊审核
          └─ 通过：推进到下一步、提示阶梯归零；不通过：给出具体原因

导师对话   POST /api/sessions/:id/chat/stream（SSE）→ 逐字流式渲染
```

## 如何加功能（扩展点）

| 想做什么 | 改哪里 |
|---|---|
| 新增内置教学模板 | `domain/fallback-plans.ts`：按关键字注册新计划，结构照抄现有模板 |
| 换更强的模型/服务商 | 改 `.env`（`LLM_BASE_URL`/`LLM_MODEL`），或实现 `infra/llm/provider.ts` 的新 Provider |
| 换更安全的代码沙箱 | 实现 `CodeRunner` 接口（`infra/runner.ts`），如 Docker / Piston / WebContainer |
| 会话持久化升级 | 实现 `KeyValueStore<StoredSession>`（`infra/store.ts`），换 Redis 等，不动领域层 |
| 调整教学节奏 | `shared/hint-ladder.ts`（阶梯规则）、`domain/stall.ts`（卡壳阈值）、`domain/tutor.ts`（冷却时长） |
| 加登录/多用户 | 在 `api/app.ts` 挂鉴权中间件，`StoredSession` 增加 userId；前端 `api.ts` 统一带 token |
| 加新语言 | `shared/types.ts` 的 `Language` + `infra/runner.ts` 实现 + 编辑器语言扩展 |

## 已知限制与后续路线

- **免费小模型的计划质量有波动**：GLM-4-Flash 生成计划约 20~90 秒；部分复杂需求（尤其 Python 目标）可能反复被质量闸门拒绝，最终回退到内置模板——这属于安全网，不会让用户拿到坏计划。追求稳定可换更强模型或提高闸门容错。
- 代码运行器是进程内沙箱（`node:vm`）+ 本机 Python 子进程，**不是安全边界**，适合本地演示/可信教学；生产需换 Docker/Piston 隔离。
- 无账号体系（演示用直开链接即可）。
- 后续：沙箱容器化、账号与分享、学习报告（提示次数曲线）、比赛三件套（PPT + 6 分钟视频 + 智能体链接部署）。
