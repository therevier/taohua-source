# 桃花源码 · 部署与比赛交付指南

> 免费方案：**Render.com**（无需云服务器、无需绑卡，Docker 部署，国内需要能访问 render.com）。
> 备选：Koyeb（免费实例）、云服务器 + Docker、内网穿透。
> 注意：Hugging Face 免费层已不支持 Docker Space（需 PRO 订阅），本条不再推荐。

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
| `PORT` | 端口，默认 8787（Hugging Face 环境会因 `SPACE_ID` 自动用 7860） |
| `PYTHON_BIN` | Python 解释器，默认 `python` |
| `NODE_ENV` | 设为 `production` 时由 Express 直接托管构建后的前端 |

## 二、部署方式

### 方案 A：Render.com（✅ 免费，推荐）

1. **前提**：代码在 GitHub 仓库（`therevier/taohua-source`）。
2. 打开 `render.com` → **Get Started** → 用 **GitHub 登录**授权。
3. 右上角 **`New +`** → **`Web Service`** → 连接 GitHub → 选择 `taohua-source` 仓库。
4. 按下表填写：

| 配置项 | 值 |
|---|---|
| Name | `taohua-source` |
| Region | Singapore（亚洲延迟低） |
| Environment | **Docker**（自动使用仓库里的 Dockerfile） |
| Instance Type | **Free** |
| Health Check Path | `/api/health` |

5. **Environment Variables** 添加 4 条：
   - `LLM_API_KEY` = 你的智谱 Key
   - `LLM_BASE_URL` = `https://open.bigmodel.cn/api/paas/v4`
   - `LLM_MODEL` = `glm-4-flash`
   - `NODE_ENV` = `production`
6. 点 **`Create Web Service`** → 等 2~5 分钟构建 → 得到链接 **`https://taohua-source.onrender.com`**（这就是比赛要交的智能体链接）。

> ⚠️ 免费实例 15 分钟无访问会休眠，评委访问前先自己打开一次唤醒（约 30~60 秒）；文件系统不持久（重启后历史会话丢失，演示可接受）。

### 方案 B：Koyeb（免费实例）

1. `app.koyeb.com` 用 GitHub 登录（免费、无需绑卡）。
2. **Create Service** → GitHub → 选 `taohua-source` → **Dockerfile** → **Instance type: Free** → Port `8787`。
3. 加环境变量（同上）。
4. 得到 `https://<名字>.koyeb.app` 链接。免费实例在法兰克福/华盛顿，国内略慢。

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
公网 IP 直接访问 `http://服务器IP:8787`（用 IP 不需要备案）。

### 方案 D：本机 + 内网穿透（临时演示）

本机 `npm run dev` 后用 cpolar / 花生壳 / ngrok 暴露 8787。依赖电脑常开、链接会变。

## 三、比赛提交检查清单

- [ ] **智能体链接**：公网可访问地址（方案 A）；打开即用，**无需登录**（如评审强制要账号，可注明「无需账号，直接访问」）
- [ ] **PPT**：≤20 页、16:9、≤50MB，命名 `【命题领域-学校-队长姓名-作品名称】`（生成脚本在 `scripts/generate-ppt.py`，内容大纲见 `docs/PPT.md`）
- [ ] **答辩视频**：≤6 分钟、MP4、≤300MB，命名同上；重点演示「老师逐步引导 → 学生独立写出 → 讲解豁然开朗」的闭环（分镜脚本见 `docs/PPT.md` 末尾）
- [ ] **匿名**：PPT / 视频 / 页面均不含学校、学生姓名、指导教师信息

## 四、提交前自测

```bash
npm run dev        # 本地起服务
node scripts/smoke.mjs   # 另开终端跑冒烟
```

再手动走一遍：建项目 → 写代码 → 运行 → 提交 → 看老师讲解 → 下一步 → 完成 → 继续完善 / 历史学习 / 知识库。

## 五、常见问题

- **首次进入慢？** 计划生成首次数十秒内（9~40 秒），相同需求走缓存秒开；总预算 120 秒自动回退模板。
- **页面出现「自由项目」标题？** 内置模板兜底，说明本次 AI 计划被质量闸门拒绝——换简单需求通常能拿到 AI 现生成计划。
- **Render 打开 502/超时？** 免费实例休眠中，等 30~60 秒唤醒后再刷新。
