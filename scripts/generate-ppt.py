# -*- coding: utf-8 -*-
"""生成「桃花源码」比赛 PPT（16:9，16 页，含备注口播）。运行: python scripts/generate-ppt.py"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

FONT = "Microsoft YaHei"
INK = RGBColor(0x4A, 0x3B, 0x47)
MUTED = RGBColor(0x9D, 0x8B, 0x97)
ACCENT = RGBColor(0xE5, 0x6B, 0x8C)
ACCENT2 = RGBColor(0x2F, 0xB8, 0xA4)
BG = RGBColor(0xFF, 0xF8, 0xF3)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK = RGBColor(0x14, 0x0B, 0x10)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def bg(slide, color=BG):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def tb(slide, x, y, w, h):
    return slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))


def set_font(run, size, bold, color, font=FONT):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = font
    run.font.color.rgb = color
    rpr = run._r.get_or_add_rPr()
    ea = rpr.find(qn("a:ea"))
    if ea is None:
        ea = rpr.makeelement(qn("a:ea"), {})
        rpr.append(ea)
    ea.set("typeface", font)


def add_par(tf, text, size=18, bold=False, color=INK, font=FONT, align=PP_ALIGN.LEFT, after=8, line=1.25):
    first = tf.paragraphs[0]
    p = first if (not first.runs and not first.text) else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(after)
    p.line_spacing = line
    run = p.add_run()
    run.text = text
    set_font(run, size, bold, color, font)
    return p


def title(slide, text, sub=None):
    box = tb(slide, 0.7, 0.45, 12.0, 0.9)
    add_par(box.text_frame, text, size=30, bold=True, color=INK)
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.72), Inches(1.32), Inches(1.1), Inches(0.09))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background()
    if sub:
        box2 = tb(slide, 0.7, 1.45, 12.0, 0.5)
        add_par(box2.text_frame, sub, size=14, color=MUTED)


def bullets(slide, items, x=0.9, y=1.95, w=11.6, h=4.6, size=19, gap=11, color=INK):
    box = tb(slide, x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for item in items:
        add_par(tf, "•  " + item, size=size, color=color, after=gap, line=1.35)


def note(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def footer(slide, idx):
    box = tb(slide, 0.7, 6.95, 9, 0.4)
    add_par(box.text_frame, "🌸 桃花源码 · 教育 · 初极狭，后豁然开朗", size=10, color=MUTED)
    box2 = tb(slide, 11.6, 6.95, 1.3, 0.4)
    add_par(box2.text_frame, f"{idx} / 16", size=10, color=MUTED, align=PP_ALIGN.RIGHT)


def shots(slide, x, y, w, h, text):
    box = tb(slide, x, y, w, h)
    add_par(box.text_frame, text, size=13, color=MUTED, align=PP_ALIGN.CENTER)
    box.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = WHITE
    shape.line.color.rgb = RGBColor(0xE9, 0xD4, 0xC8)
    shape.line.width = Pt(1)
    shape.shadow.inherit = False
    return shape


def table(slide, data, x, y, w, col_w, row_h=0.55):
    rows, cols = len(data), len(data[0])
    shape = slide.shapes.add_table(rows, cols, Inches(x), Inches(y), Inches(w), Inches(row_h * rows))
    tbl = shape.table
    for i, width in enumerate(col_w):
        tbl.columns[i].width = Inches(width)
    for r, row in enumerate(data):
        for c, text in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = ""
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            run = p.add_run()
            run.text = str(text)
            set_font(run, 14 if r else 14, r == 0, WHITE if r == 0 else INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = ACCENT if r == 0 else (WHITE if r % 2 == 0 else RGBColor(0xFF, 0xF3, 0xEF))
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.15)
            cell.margin_right = Inches(0.1)


# ------------------------------------------------------------------
# 1 封面
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s, DARK)
box = tb(s, 1.2, 1.6, 11, 1.5)
add_par(box.text_frame, "桃花源码", size=54, bold=True, color=WHITE)
box = tb(s, 1.25, 3.2, 11, 0.7)
add_par(box.text_frame, "老师手把手，一步步走进代码的桃花源", size=22, color=RGBColor(0xF0, 0xC6, 0xD8))
box = tb(s, 1.25, 4.2, 11, 0.6)
add_par(box.text_frame, "初极狭，后豁然开朗", size=22, color=RGBColor(0x7C, 0xE0, 0xD0), font="KaiTi")
box = tb(s, 1.25, 6.4, 11, 0.5)
add_par(box.text_frame, "命题领域：教育 · AI Agent 应用", size=15, color=RGBColor(0x9D, 0x8B, 0x97))
note(s, "开场：大家好，我们是桃花源码。桃花源记里那句「初极狭，才通人」，正是每个初学者面对代码时的感受——但只要一步步走，就会豁然开朗。")

# ------------------------------------------------------------------
# 2 背景
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "作品背景：AI 时代的编程学习困境")
bullets(
    s,
    [
        "AI 写代码越来越强，学生把 AI 当黑盒：作业交得出来，原理说不明白",
        "热议话题：「AI 时代学编程还有没有意义？」",
        "学练脱节：看教程会、做题会，真做项目时「想不出要写什么」",
        "所以我们认为：学编程的意义，从「会写」变成了「懂原理、能拆解」",
    ],
)
footer(s, 2)
note(s, "AI 把门槛降低了，但也让很多人对用 AI 做出来的东西一知半解。我们的切入点不是「让 AI 替你写」，而是「陪你真正学会」。")

# ------------------------------------------------------------------
# 3 我们的答案
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "我们的答案：陪练式教学 Agent")
bullets(
    s,
    [
        "定位：不是代写助手，而是坐在旁边的老师",
        "每个项目 = 一段「老师引导 → 学生亲手写 → 老师讲解」的旅程",
        "Agent 只做三件事：分解任务、讲解原理、卡壳时分级提示",
        "学生全程自己写代码，绝不直接给答案",
    ],
)
footer(s, 3)
note(s, "Copilot 们帮你写，桃花源码陪你写。我们卖的不是代码，而是「你自己想出来」的那个瞬间。")

# ------------------------------------------------------------------
# 4 教学理念
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "教学理念：零基础「先教，再练」，目标导向")
bullets(
    s,
    [
        "零基础学生没学过概念，直接「引导」等于让他猜",
        "所以每步都是一节迷你课：教概念 → 给示例 → 照抄模仿 → 运行验证 → 讲解",
        "目标导向：3-6 步从零基础一直做到「能用的成品」",
        "完成后不结束：说「我想加个删除功能」，老师继续生成新步骤",
    ],
)
shots(s, 8.4, 2.1, 4.2, 3.6, "（截图位：启动页 + 进入动画）")
footer(s, 4)
note(s, "「初极狭，才通人」，正是初学者面对代码的感受。我们每节课都先在窄处把概念讲透，再放手让学生自己走，最后真的做出一个能用的东西。")

# ------------------------------------------------------------------
# 5 教学循环
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "核心机制一：迷你课五段式")
bullets(
    s,
    [
        "① 教：用生活比喻讲概念（「变量 = 贴了标签的盒子」）",
        "② 范：对话框里给出可运行的最小示例",
        "③ 练：任务具体到能照做（「写一行 console.log('你好，桃花源');」）",
        "④ 验：运行，输出出现预期内容 → 提交",
        "⑤ 结：讲解概念、为什么、易错点 + 立刻预告下一步",
        "每步只引入 1 个新概念，后一步回扣前一步",
    ],
    size=17,
)
shots(s, 8.4, 2.1, 4.2, 3.6, "（截图位：概念解释 + 示例代码 + 具体任务）")
footer(s, 5)
note(s, "学生不需要提前会什么：概念是老师讲的，例子是老师给的，他要做的只是亲手写出来，然后看到程序真的跑起来。")

# ------------------------------------------------------------------
# 6 提示阶梯 + 防作弊
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "核心机制二：提示阶梯 + 防作弊")
bullets(
    s,
    [
        "卡壳检测：编辑停顿 / 连续运行失败 → 老师主动出现",
        "L1 方向问句 → L2 定位提示 → L3 伪代码（自动提示封顶 L3）",
        "绝不直接给完整代码；手动求助递进一级",
        "提交时防作弊审核：直接打印结果会被打回",
    ],
)
footer(s, 6)
note(s, "我们把「提示」设计成阶梯：先问方向，再给定位，最后才给伪代码。就算学生想抄，也要先真正想一遍。")

# ------------------------------------------------------------------
# 7 质量闸门
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "核心机制三：计划质量闸门")
bullets(
    s,
    [
        "AI 生成的计划必须「实跑验证」：参考实现能跑通验收、起始代码不能假通过",
        "不合格 → 定向修复（只重写坏掉的那一步）→ 仍不合格用内置模板兜底",
        "结果：任何情况下都有可教学、可运行的项目，不会把坏计划交给学生",
    ],
)
footer(s, 7)
note(s, "这是工程上的底线：我们不能让学生拿到跑不起来的项目。所以每份 AI 计划都先过一遍「实跑质检」。")

# ------------------------------------------------------------------
# 8 界面导览
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "产品演示：界面导览")
bullets(
    s,
    [
        "左侧：老师对话（指令 / 讲解 / 提示）",
        "右侧：步骤条 → 当前任务 → 编辑器 → 运行/提交/提示 → 控制台",
        "学过的项目沉淀为「历史学习」，每一步沉淀为「知识库」",
        "极简设计：三块区域，不需要说明书就能上手",
    ],
)
shots(s, 8.4, 2.1, 4.2, 3.6, "（截图位：完整工作区）")
footer(s, 8)
note(s, "整体就是三块：老师在左，代码在右，输出在下面。学生一进来就知道该干什么。")

# ------------------------------------------------------------------
# 9 数据收集与处理
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "数据收集与处理")
bullets(
    s,
    [
        "模型接入：OpenAI 兼容接口，实测智谱 glm-4-flash（免费、快、支持流式）",
        "提示词工程：模块分解 / 注释极简 / 真实断言 / 禁止代写等硬约束",
        "质量数据：每份计划实跑校验；验收标准「通过: true」机器可判",
        "兜底数据：内置 4 套教学模板（待办 / 计算器 / Python 词频 / 自由项目）",
    ],
)
footer(s, 9)
note(s, "我们不依赖单一模型：换模型只改环境变量；质量靠「实跑校验」而不是模型自觉。")

# ------------------------------------------------------------------
# 10 分析过程
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "分析过程：每条设计背后的判断")
bullets(
    s,
    [
        "为什么「先指令、后讲解」？降低认知负荷 + 即时正反馈",
        "为什么讲解放对话框而非代码注释？新手不被注释淹没，注意力集中在「老师 → 代码」",
        "为什么提示分三级？既解决卡壳，又不破坏独立思考",
        "为什么先「定接口」再写逻辑？想清数据怎么进出，才不会写一半迷路",
    ],
)
footer(s, 10)
note(s, "这些不是拍脑袋：每一条都是对「初学者怎么真的学会」的判断。")

# ------------------------------------------------------------------
# 11 创新性
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "创新性与独特视角")
bullets(
    s,
    [
        "不代写定位：行业普遍「帮你写」，我们「逼你自己写」",
        "桃花源意象：古典文学 × 编程启蒙，把「豁然开朗」变成产品体验",
        "知识沉淀：每一步沉淀一张知识卡片，形成个人知识库",
        "极简教学法：三块界面 + 一句指令 + 一句讲解，新手零门槛",
    ],
)
footer(s, 11)
note(s, "最大的创新是克制：我们主动放弃「一键生成代码」的爽点，换取学习过程的真实发生。")

# ------------------------------------------------------------------
# 12 对话界面
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "应用结果呈现：对话界面")
bullets(
    s,
    [
        "学生输入需求 → 老师开场 → 写码 → 自测 → 提交 → 老师讲解 + 下一步",
        "三段截图：① 老师开场指令 ② 卡壳分级提示 ③ 完成讲解与下一步",
    ],
)
shots(s, 0.9, 2.5, 5.6, 3.3, "（截图位：老师开场 + 第一步指令）")
shots(s, 6.9, 2.5, 5.6, 3.3, "（截图位：完成讲解 + 下一步）")
footer(s, 12)
note(s, "现场演示时，请按「开场 → 写 → 提交 → 讲解」顺序走一遍，展示学生全程自己写。")

# ------------------------------------------------------------------
# 13 提示词示例
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "提示词示例（≥3 个）")
table(
    s,
    [
        ["示例", "输入提示词", "输出"],
        ["待办清单", "用 JavaScript 写一个待办清单小工具", "3 步计划，老师逐步引导"],
        ["计算器", "用 JavaScript 做一个四则运算计算器", "运算核心 → 解析 → 组装"],
        ["词频统计", "用 Python 统计一段文本的词频", "统计 → 排序 → 报告"],
        ["智能体链接", "（部署后填入公网地址）", "现场可打开"],
    ],
    x=0.9,
    y=2.0,
    w=11.5,
    col_w=[2.2, 5.6, 3.7],
)
footer(s, 13)
note(s, "三个例子覆盖 JS/Python、数据结构/算法/数据处理，都是公开可复现的提示词。")

# ------------------------------------------------------------------
# 14 问题与建议
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "问题与建议")
bullets(
    s,
    [
        "问题：免费小模型的计划质量有波动（被质量闸门拦截后回退模板）",
        "建议：演示用固定提示词预热（相同需求第二次走缓存秒开）",
        "建议：正式版接入更强模型 / 人工审核模板库",
        "建议：增加学习报告（提示次数曲线），作为教学效果证据",
    ],
)
footer(s, 14)
note(s, "我们如实说明限制：免费模型有波动，但质量闸门保证学生永远拿到可运行的计划。")

# ------------------------------------------------------------------
# 15 风险与应对
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "风险识别与应对")
table(
    s,
    [
        ["风险", "应对"],
        ["模型幻觉 / 格式错误", "实跑质量闸门 + 定向修复 + 模板兜底"],
        ["学生复制粘贴", "提示阶梯 + 提交时防作弊审核"],
        ["沙箱安全", "演示版 vm/子进程；生产换容器隔离"],
        ["数据隐私", "会话匿名，不采集个人信息"],
    ],
    x=0.9,
    y=2.0,
    w=11.5,
    col_w=[4.2, 7.3],
)
footer(s, 15)
note(s, "这四条是我们上线前想清楚的：模型有波动、学生可能抄、沙箱不是安全边界、数据要匿名。")

# ------------------------------------------------------------------
# 16 路线图与结尾
# ------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
bg(s)
title(s, "路线图与致谢")
bullets(
    s,
    [
        "近期：多人课堂、学习报告（提示次数曲线）、多语言支持",
        "中期：容器化沙箱、账号体系、企业培训版",
        "把「初极狭，后豁然开朗」做成每个初学者的一次真实体验",
    ],
)
footer(s, 16)
note(s, "我们想做的事很简单：让每个初学者都有一次「豁然开朗」的编程体验。谢谢大家。")

prs.save("docs/桃花源码-比赛PPT.pptx")
print("saved docs/桃花源码-比赛PPT.pptx, slides:", len(prs.slides))
