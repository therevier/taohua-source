# 桃花源码 · 部署与比赛交付指南

> 没有云服务器也可以：本文档的**方案 A（Hugging Face Spaces）完全免费**，只需注册一个账号。

## 一、运行所需环境

- Node.js ≥ 22（推荐 24：内置 `node:sqlite`，无原生依赖）
- Python 3（仅当需要 Python 沙箱运行时）
- 一个 OpenAI 兼容的模型 Key（默认已配智谱 `glm-4-flash`）

环境变量（`.env` 或部署平台的 Variables/Secrets）：

| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | 模型 Key（不配则为离线演示模式） |
| `LLM_BASE_URL` | 智谱：`https://open.bigmodel.cn/api/paas/v4`；DeepSeek：`https://api.deepseek.com/v1` |
| `LLM_MODEL` | 智谱：`glm-4-flash`；DeepSeek：`deepseek-chat` |
| `PORT` | 端口，默认 8787；**Hugging Face 免费 Space 必须设为 `7860`** |
| `PYTHON_BIN` | Python 解释器，默认 `python` |
| `NODE_ENV` | 设为 `production` 时由 Express 直接托管构建后的前端 |

## 二、部署方式

### 方案 A：Hugging Face Spaces（✅ 免费，推荐）

> 免费 Docker Space，公网 https 链接，无需云服务器。缺点：闲置约 15 分钟会休眠（唤醒后首次访问较慢）；文件系统不持久（重启后 SQLite 数据会丢，演示可接受）。

1. **注册**：打开 <https://huggingface.co>，用邮箱注册（免费）。
2. **创建 Space**：右上角 `New` → `Space` → 填名称 → **SDK 选 `Docker`** → 模板选 `Blank` → 设公开 → 创建。
   - 创建后进入 Space 页面，可以看到 `Files`、`Settings` 等标签。
3. **上传代码**（二选一）：
   - A1（推荐，本地 git 推送）：
     ```bash
     cd code-mentor
     git init
     git add .
     git commit -m "桃花源码"
     git remote add hf https://huggingface.co/spaces/<你的用户名>/<空间名>
     git push hf main
     ```
     推送时用户名填你的 HF 用户名，密码填一个 **HF Access Token**（Settings → Access Tokens → New token，勾选 write）。
   - A2（网页上传）：在 Space 的 `Files` 页逐个/批量上传本仓库（不含 `node_modules`、`data`、`.env`；请直接上传 `Dockerfile`、`package.json`、`package-lock.json`、`src/`、`index.html`、`tsconfig.json`、`vite.config.ts`、`scripts/`、`public` 无则忽略）。
4. **设置 Secrets**：Space 页面 → `Settings` → `Variables and secrets`：
   - Secret：`LLM_API_KEY = 你的Key`
   - Variable：`LLM_BASE_URL = https://open.bigmodel.cn/api/paas/v4`
   - Variable：`LLM_MODEL = glm-4-flash`
   - Variable：`PORT = 7860`（免费 Space 只允许监听 7860）
5. **等待构建**：Space 页面会自动构建（约 1~3 分钟），状态变绿后访问：
   `https://<你的用户名>-<空间名>.hf.space`
6. **给评委的链接**：就是你上一步的地址；**无需登录**（页面不含学校/姓名信息，符合匿名要求）。

> 注意：免费 Space 闲置会休眠，**评委访问前先自己打开一次唤醒**（唤醒约 30~60 秒）。

### 方案 B：Render（可选，免费）

1. 注册 GitHub + Render；把代码推到 GitHub；
2. Render 新建 `Web Service` → 关联仓库 → 构建命令 `npm ci --ignore-scripts && npm run build`，启动命令 `npm start`；
3. 环境变量同上（PORT 用 8787 或平台默认）；
4. 免费层休眠后冷启动约 1 分钟；文件系统不持久（会话数据会丢）。

### 方案 C：云服务器 + Docker（最稳，需付费）

```bash
docker build -t peach-source .
docker run -d --name peach-source -p 8787:8787 \
  -e LLM_API_KEY=你的Key \
  -e LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4 \
  -e LLM_MODEL=glm-4-flash \
  -v /opt/peach-data:/app/data \
  peach-source
```
访问 `http://服务器IP:8787`；正式演示建议加域名 + HTTPS。

### 方案 D：本机 + 内网穿透（临时）

本机 `npm run dev` 后用 cpolar / 花生壳 / ngrok 等暴露 8787。适合临时演示，链接可能变化。

## 三、比赛提交检查清单

- [ ] **智能体链接**：公网 https 地址（方案 A 即可）；打开即用，**无需登录**（如评审强制要求账号，可说明“无需账号，直接访问”）
- [ ] **PPT**：≤20 页、16:9、≤50MB，命名 `【命题领域-学校-队长姓名-作品名称】`；内容按六段框架（作品背景/数据收集与处理/分析过程/创新性与独特视角/结果解释与建议/应用结果呈现，含对话界面截图 + ≥3 个提示词示例 + 链接）
- [ ] **答辩视频**：≤6 分钟、MP4、≤300MB，命名同上；重点演示「老师逐步引导 → 学生独立写出 → 讲解豁然开朗」的闭环
- [ ] **匿名**：PPT / 视频 / 页面均不含学校、学生姓名、指导教师信息

## 四、提交前自测

```bash
npm run dev        # 本地起服务
node scripts/smoke.mjs   # 另开终端跑冒烟
```

再手动走一遍：建项目 → 写代码 → 运行 → 提交 → 看老师讲解 → 下一步 → 完成 → 历史学习/知识库。

## 五、常见问题

- **首次进入慢？** 计划生成首次数十秒内（实测 9~15 秒），相同需求走缓存秒开；总预算 120 秒自动回退模板。
- **页面出现「自由项目 / 单词词频统计」标题？** 内置模板兜底，说明本次 AI 计划被质量闸门拒绝——换简单需求通常能拿到 AI 现生成计划。
- **HF Space 打开 502/超时？** 可能正在冷启动，等 1 分钟再刷新。
- **中文乱码？** Python 已强制 UTF-8；Linux 环境需安装 Python3 或设置 `PYTHON_BIN`。
