import type { Language, ProjectPlan, TaskNode } from '../../shared/types';

/**
 * 内置兜底教学计划模板（「桃花源码」老师口吻，突出简洁直接）。
 *
 * 用途：
 * 1. 没配置 LLM Key 时直接使用，保证演示完全可用、可复现；
 * 2. 作为 LLM 计划的兜底——LLM 失败或质量闸门拒绝时，按关键词选模板。
 *
 * 每个任务都遵循同一套可验证格式：
 * - brief：老师开场指令（1-2 句，说清这一步写什么）；
 * - explain：完成后的一句话讲解（这块是什么、为什么）；
 * - skeleton：起始代码（只保留一行 TODO + 自测代码，学生不用改）；
 * - acceptance：机器验收（看到「通过: true」即完成）；
 * - hints：卡壳时的 L1/L2/L3 引导语。
 */

const PASS = '通过: true';
const PASS_PY = '通过: True';

function byOutputContains(value: string): TaskNode['acceptance'] {
  return { type: 'output_contains', value };
}

export function buildFallbackPlan(goal: string): ProjectPlan {
  if (/python|词频|单词|统计/i.test(goal)) return wordCounterPlan();
  if (/计算器|运算|calculator/i.test(goal)) return calculatorPlan();
  if (/待办|todo|清单|任务管理/i.test(goal)) return todoPlan();
  return freeformPlan(goal);
}

/* ------------------------------------------------------------------ */
/* 模板一：待办清单（JavaScript）                                       */
/* ------------------------------------------------------------------ */

function todoPlan(): ProjectPlan {
  return {
    title: '待办清单小工具（JavaScript）',
    overview: '用数组装待办，再加状态和筛选，最后拼出一个完整小工具。',
    language: 'javascript',
    tasks: [todoTask1(), todoTask2(), todoTask3()],
  };
}

function todoTask1(): TaskNode {
  const skeleton = `// TODO: 实现 addTodo 和 listTodos

function addTodo(list, text) {
}

function listTodos(list) {
}

const list = [];
addTodo(list, '买牛奶');
addTodo(list, '学 JavaScript');
list[1].done = true;
listTodos(list);
console.log('通过:', list.length === 2 && list[0].text === '买牛奶' && list[1].done === true);
`;
  const reference = `function addTodo(list, text) {
  const item = { id: list.length + 1, text, done: false };
  list.push(item);
  return item;
}

function listTodos(list) {
  for (const item of list) {
    console.log((item.done ? '[x] ' : '[ ] ') + item.text);
  }
}

const list = [];
addTodo(list, '买牛奶');
addTodo(list, '学 JavaScript');
list[1].done = true;
listTodos(list);
console.log('通过:', list.length === 2 && list[0].text === '买牛奶' && list[1].done === true);
`;
  return {
    id: 'todo-1',
    title: '先把数据放进去',
    goal: '用数组存放对象 + 函数拆分',
    instructions: '实现 addTodo 与 listTodos 两个函数，让自测打印「通过: true」。',
    brief: '先写第一块：addTodo(list, text) 生成一条 { id, text, done } 记录放进数组；listTodos(list) 按「[ ] 文本」或「[x] 文本」打印每条。自测不用改，看到「通过: true」再提交。',
    explain: '这是清单的「数据底座」：一个负责记住待办，一个负责念出来。后面的完成、筛选、汇总，都建立在这两块上。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['addTodo 需要返回什么？listTodos 要打印成什么格式？先想清楚这两点。'],
      L2: ['用 list.length 算新 id；用 for...of 遍历，item.done 决定前缀是「[ ] 」还是「[x] 」。'],
      L3: 'addTodo 伪代码：item = { id: list.length + 1, text, done: false } → push → return item。listTodos：循环打印 prefix + item.text。',
      L4: '先复述：为什么用数组存对象？id 为什么从 1 开始？然后对照参考实现重写。',
    },
    reference,
  };
}

function todoTask2(): TaskNode {
  const skeleton = `// TODO: 实现 markDone 和 filterTodos

function markDone(list, id) {
}

function filterTodos(list, doneMode) {
}

const list = [
  { id: 1, text: '买牛奶', done: false },
  { id: 2, text: '学 JavaScript', done: true },
];
markDone(list, 1);
console.log(list[0].text, '->', list[0].done ? '[x]' : '[ ]');
console.log('已完成:', filterTodos(list, true).map((t) => t.text).join('、'));
console.log('未完成:', filterTodos(list, false).map((t) => t.text).join('、'));
console.log('通过:', list[0].done === true && filterTodos(list, true).length === 2 && filterTodos(list, false).length === 0);
`;
  const reference = `function markDone(list, id) {
  const item = list.find((todo) => todo.id === id);
  if (item) item.done = true;
}

function filterTodos(list, doneMode) {
  return list.filter((item) => item.done === doneMode);
}

const list = [
  { id: 1, text: '买牛奶', done: false },
  { id: 2, text: '学 JavaScript', done: true },
];
markDone(list, 1);
console.log(list[0].text, '->', list[0].done ? '[x]' : '[ ]');
console.log('已完成:', filterTodos(list, true).map((t) => t.text).join('、'));
console.log('未完成:', filterTodos(list, false).map((t) => t.text).join('、'));
console.log('通过:', list[0].done === true && filterTodos(list, true).length === 2 && filterTodos(list, false).length === 0);
`;
  return {
    id: 'todo-2',
    title: '让待办能被勾掉',
    goal: 'find/filter 与对象属性修改',
    instructions: '实现 markDone 与 filterTodos，让自测打印「通过: true」。',
    brief: '给数据加状态：markDone(list, id) 按 id 找到条目并把 done 改为 true；filterTodos(list, doneMode) 返回已完成（true）或未完成（false）的数组。看到「通过: true」再提交。',
    explain: '这一步让待办能勾掉、能筛选——很多产品里的待办列表，底层就是这两个小函数。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['按 id 找到一条待办，用什么方法？筛选数组又用什么？'],
      L2: ['find 按 id 找条目；filter 的回调返回布尔值，item.done === doneMode 能同时覆盖已完成和未完成。'],
      L3: 'markDone 伪代码：item = list.find(t => t.id === id)；if (item) item.done = true。filterTodos：return list.filter(t => t.done === doneMode)。',
      L4: '复述 find 和 filter 的区别：找不到 id 时 markDone 应该做什么？然后对照参考实现重写。',
    },
    reference,
  };
}

function todoTask3(): TaskNode {
  const skeleton = `// TODO: 实现 summarize

function summarize(list) {
}

const list = [
  { id: 1, text: '买牛奶', done: false },
  { id: 2, text: '学 JavaScript', done: true },
  { id: 3, text: '写周报', done: true },
];
console.log(summarize(list));
console.log('通过:', summarize(list) === '共 3 项，完成 2 项，未完成 1 项');
`;
  const reference = `function summarize(list) {
  const done = list.filter((item) => item.done).length;
  return '共 ' + list.length + ' 项，完成 ' + done + ' 项，未完成 ' + (list.length - done) + ' 项';
}

const list = [
  { id: 1, text: '买牛奶', done: false },
  { id: 2, text: '学 JavaScript', done: true },
  { id: 3, text: '写周报', done: true },
];
console.log(summarize(list));
console.log('通过:', summarize(list) === '共 3 项，完成 2 项，未完成 1 项');
`;
  return {
    id: 'todo-3',
    title: '最后盘一个汇总',
    goal: '组合 filter 计数与字符串拼接',
    instructions: '实现 summarize 返回汇总文本，让自测打印「通过: true」。',
    brief: '最后盘个汇总：summarize(list) 返回「共 X 项，完成 Y 项，未完成 Z 项」，用中文逗号。',
    explain: '把统计和拼接组合起来，这个小工具就完整了——你写的每一块在这里拼成了整体。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['汇总需要三个数字：总数、完成数、未完成数。未完成数能不能由前两个算出来？'],
      L2: ['完成数用 list.filter(t => t.done).length；未完成数 = list.length - done；注意中文逗号和空格。'],
      L3: 'summarize 伪代码：done = filter(...).length；total = list.length；return「共 X 项，完成 Y 项，未完成 Z 项」。',
      L4: '想想：为什么返回值而不是直接打印？然后对照参考实现重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板二：计算器（JavaScript）                                         */
/* ------------------------------------------------------------------ */

function calculatorPlan(): ProjectPlan {
  return {
    title: '四则运算计算器（JavaScript）',
    overview: '先做运算核心，再解析表达式，最后把两层拼成一个小计算器。',
    language: 'javascript',
    tasks: [calcTask1(), calcTask2(), calcTask3()],
  };
}

function calcTask1(): TaskNode {
  const skeleton = `// TODO: 实现 add、sub、mul、div

function add(a, b) {
}

function sub(a, b) {
}

function mul(a, b) {
}

function div(a, b) {
}

console.log(add(2, 3), sub(5, 2), mul(2, 3), div(8, 4));
console.log('通过:', add(2, 3) === 5 && sub(5, 2) === 3 && mul(2, 3) === 6 && div(8, 4) === 2 && div(1, 0) === null);
`;
  const reference = `function add(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}

function mul(a, b) {
  return a * b;
}

function div(a, b) {
  if (b === 0) return null;
  return a / b;
}

console.log(add(2, 3), sub(5, 2), mul(2, 3), div(8, 4));
console.log('通过:', add(2, 3) === 5 && sub(5, 2) === 3 && mul(2, 3) === 6 && div(8, 4) === 2 && div(1, 0) === null);
`;
  return {
    id: 'calc-1',
    title: '先写算术核心',
    goal: '函数返回值与除零保护',
    instructions: '实现四个运算函数，让自测打印「通过: true」。',
    brief: '先写算术核心：add/sub/mul/div 各接收两个数字返回结果；div 除数为 0 时返回 null。',
    explain: '这是计算器的算术层。div 里提前挡掉除零，后面的代码就不用到处判断。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['每个函数都要用 return。div 遇到 0 时应该怎么办？'],
      L2: ['add/sub/mul 都是一行 return；div 先判断 b === 0 就 return null。'],
      L3: '伪代码：function add(a, b) { return a + b; }；function div(a, b) { if (b === 0) return null; return a / b; }',
      L4: '复述：除零保护为什么用提前返回？然后对照参考实现重写。',
    },
    reference,
  };
}

function calcTask2(): TaskNode {
  const skeleton = `// TODO: 实现 parseExpression

function parseExpression(text) {
}

const expr = parseExpression('12 + 3');
console.log(expr);
console.log('通过:', expr.a === 12 && expr.op === '+' && expr.b === 3);
`;
  const reference = `function parseExpression(text) {
  const parts = text.trim().split(/\\s+/);
  return { a: Number(parts[0]), op: parts[1], b: Number(parts[2]) };
}

const expr = parseExpression('12 + 3');
console.log(expr);
console.log('通过:', expr.a === 12 && expr.op === '+' && expr.b === 3);
`;
  return {
    id: 'calc-2',
    title: '把人话翻译成数据',
    goal: '字符串拆分、类型转换与对象返回',
    instructions: '实现 parseExpression，让自测打印「通过: true」。',
    brief: '把人话翻译成数据：parseExpression(text) 把 "12 + 3" 拆成 { a: 12, op: \'+\', b: 3 }，a、b 要转换成数字。',
    explain: '你刚做的是「解析」：先把用户输入变成结构化数据，后面才知道该调用哪个运算。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['字符串怎么按空格拆开？拆完是字符串还是数字？'],
      L2: ['用 text.trim().split(/\\s+/) 拆成数组，按位置取；a、b 用 Number(...) 转换。'],
      L3: '伪代码：parts = text.trim().split(/\\s+/)；return { a: Number(parts[0]), op: parts[1], b: Number(parts[2]) }。',
      L4: '想一下：输入少于三项时这个函数会怎样？先复述再重写。',
    },
    reference,
  };
}

function calcTask3(): TaskNode {
  const skeleton = `// TODO: 实现 calculate

function calculate(text) {
}

console.log(calculate('12 + 3'));
console.log(calculate('8 / 0'));
console.log(calculate('abc'));
console.log('通过:', calculate('12 + 3') === 15 && calculate('8 / 0') === null && calculate('abc') === null);
`;
  const reference = `function parseExpression(text) {
  const parts = text.trim().split(/\\s+/);
  if (parts.length !== 3) return null;
  return { a: Number(parts[0]), op: parts[1], b: Number(parts[2]) };
}

function calculate(text) {
  const expr = parseExpression(text);
  if (!expr) return null;
  if (!Number.isFinite(expr.a) || !Number.isFinite(expr.b)) return null;
  switch (expr.op) {
    case '+':
      return expr.a + expr.b;
    case '-':
      return expr.a - expr.b;
    case '*':
      return expr.a * expr.b;
    case '/':
      return expr.b === 0 ? null : expr.a / expr.b;
    default:
      return null;
  }
}

console.log(calculate('12 + 3'));
console.log(calculate('8 / 0'));
console.log(calculate('abc'));
console.log('通过:', calculate('12 + 3') === 15 && calculate('8 / 0') === null && calculate('abc') === null);
`;
  return {
    id: 'calc-3',
    title: '两层拼起来',
    goal: '解析 + 运算 + 错误处理的组合',
    instructions: '实现 calculate 组合解析与运算，让自测打印「通过: true」。',
    brief: '把两层拼起来：calculate(text) 先解析表达式，再按 op 调用对应运算；除零或格式不对返回 null。上一步的解析函数可以直接搬用。',
    explain: '这一步是「组装」：解析层 + 运算层拼在一起。一个功能往往就是这样一块块叠出来的。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['calculate 先解析再分支计算。哪一步可能失败？'],
      L2: ['先调 parseExpression，解析失败就 return null；用 switch (expr.op) 分四种情况，除法单独处理 0。'],
      L3: '伪代码：expr = parseExpression(text)；if (!expr) return null；switch(expr.op) → + 返回 a+b……/ 返回 b === 0 ? null : a / b。',
      L4: '复述：为什么用提前返回而不是层层嵌套？然后对照参考实现重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板三：词频统计（Python）                                           */
/* ------------------------------------------------------------------ */

function wordCounterPlan(): ProjectPlan {
  return {
    title: '词频统计小工具（Python）',
    overview: '先统计词频，再排序取 Top N，最后生成一句汇总报告。',
    language: 'python',
    tasks: [wcTask1(), wcTask2(), wcTask3()],
  };
}

function wcTask1(): TaskNode {
  const skeleton = `# TODO: 实现 count_words


def count_words(text):
    pass


text = 'The Cat and the dog, the cat!'
result = count_words(text)
print('结果:', result)
print('通过:', result.get('the') == 3 and result.get('cat') == 2 and result.get('dog') == 1)
`;
  const reference = `def count_words(text):
    text = text.lower().replace(',', ' ').replace('.', ' ').replace('!', ' ')
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts


text = 'The Cat and the dog, the cat!'
result = count_words(text)
print('结果:', result)
print('通过:', result.get('the') == 3 and result.get('cat') == 2 and result.get('dog') == 1)
`;
  return {
    id: 'wc-1',
    title: '先把单词数出来',
    goal: 'lower / replace / split / 计数字典',
    instructions: '实现 count_words 返回词频字典，让自测打印「通过: True」。',
    brief: '先数单词：count_words(text) 返回「单词 -> 次数」的字典，统计前忽略大小写，并把 , . ! 换成空格。',
    explain: '这是统计的核心：用字典把单词和次数对应起来。get(word, 0) + 1 是计数的经典写法。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains(PASS_PY),
    hints: {
      L1: ['字典的键是单词，值是什么？忽略大小写和标点要先做什么处理？'],
      L2: ['先用 text.lower() 统一大小写；用 replace 把 , . ! 换成空格；计数用 counts.get(word, 0) + 1。'],
      L3: '伪代码：text = text.lower().replace(...)；counts = {}；for word in text.split(): counts[word] = counts.get(word, 0) + 1；return counts。',
      L4: '复述：get(word, 0) 为什么不能省？单词第一次出现会发生什么？然后对照参考实现重写。',
    },
    reference,
  };
}

function wcTask2(): TaskNode {
  const skeleton = `# TODO: 实现 top_words


def count_words(text):
    text = text.lower().replace(',', ' ').replace('.', ' ').replace('!', ' ')
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts


def top_words(text, n):
    pass


text = 'the cat and the dog and the cat'
print(top_words(text, 2))
print('通过:', top_words(text, 2) == [('the', 3), ('cat', 2)])
`;
  const reference = `def count_words(text):
    text = text.lower().replace(',', ' ').replace('.', ' ').replace('!', ' ')
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts


def top_words(text, n):
    counts = count_words(text)
    pairs = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return pairs[:n]


text = 'the cat and the dog and the cat'
print(top_words(text, 2))
print('通过:', top_words(text, 2) == [('the', 3), ('cat', 2)])
`;
  return {
    id: 'wc-2',
    title: '让词频排队',
    goal: 'sorted + key 函数 + 切片',
    instructions: '实现 top_words，让自测打印「通过: True」。',
    brief: '让词频排队：top_words(text, n) 返回次数最多的前 n 个词，按次数从高到低，格式 [(\'the\', 3), (\'cat\', 2)]。',
    explain: '这一步把统计结果变成排行榜：items() → sorted 降序 → 切片取前 n 个。数据变成了信息。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains(PASS_PY),
    hints: {
      L1: ['字典能直接按值排序吗？不能的话先把它转换成什么？'],
      L2: ['用 counts.items() 得到键值对；sorted(..., key=lambda item: item[1], reverse=True) 按次数降序；切片 pairs[:n]。'],
      L3: '伪代码：counts = count_words(text)；pairs = sorted(counts.items(), key=lambda item: item[1], reverse=True)；return pairs[:n]。',
      L4: '复述：key=lambda item: item[1] 里的 item[1] 是什么？然后对照参考实现重写。',
    },
    reference,
  };
}

function wcTask3(): TaskNode {
  const skeleton = `# TODO: 实现 report


def count_words(text):
    text = text.lower().replace(',', ' ').replace('.', ' ').replace('!', ' ')
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts


def top_words(text, n):
    counts = count_words(text)
    pairs = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return pairs[:n]


def report(text, n):
    pass


text = 'the cat and the dog and the cat'
line = report(text, 2)
print(line)
print('通过:', line == '共 4 个不同单词；出现最多的前 2 个：the(3)、cat(2)')
`;
  const reference = `def count_words(text):
    text = text.lower().replace(',', ' ').replace('.', ' ').replace('!', ' ')
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts


def top_words(text, n):
    counts = count_words(text)
    pairs = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return pairs[:n]


def report(text, n):
    counts = count_words(text)
    top = top_words(text, n)
    parts = '、'.join(f'{word}({count})' for word, count in top)
    return f'共 {len(counts)} 个不同单词；出现最多的前 {n} 个：{parts}'


text = 'the cat and the dog and the cat'
line = report(text, 2)
print(line)
print('通过:', line == '共 4 个不同单词；出现最多的前 2 个：the(3)、cat(2)')
`;
  return {
    id: 'wc-3',
    title: '生成一句人话报告',
    goal: 'f-string 拼接格式化文本',
    instructions: '实现 report 返回汇总字符串，让自测打印「通过: True」。',
    brief: '生成一句人话报告：report(text, n) 返回「共 X 个不同单词；出现最多的前 n 个：the(3)、cat(2)」，用全角标点。',
    explain: '统计 → 排序 → 报告，一个完整的数据小工具链就搭好了——词云、热搜榜背后都是这三步。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains(PASS_PY),
    hints: {
      L1: ['报告里要拼哪些数字？不同单词总数从哪里拿？'],
      L2: ['len(counts) 得到不同单词数；f"{word}({count})" 生成词条；"、".join(...) 连接；冒号和括号用全角。'],
      L3: '伪代码：counts = count_words(text)；top = top_words(text, n)；parts = 「、」.join(f「{w}({c})」 for w, c in top)；return 拼接文本。',
      L4: '复述：f-string 和 join 各自解决什么问题？然后对照参考实现重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板四：自由项目（任意目标兜底）                                      */
/* ------------------------------------------------------------------ */

function freeformPlan(goal: string): ProjectPlan {
  const shortGoal = goal.length > 30 ? `${goal.slice(0, 30)}…` : goal;
  return {
    title: `自由项目：${shortGoal}`,
    overview: '按「先定接口 → 写主干 → 补边界」推进：先想清楚输入输出，再让程序跑起来，最后处理意外情况。',
    language: 'javascript',
    tasks: [freeTask1(goal), freeTask2(goal), freeTask3(goal)],
  };
}

function freeTask1(goal: string): TaskNode {
  const skeleton = `// TODO: 在注释里写清输入/输出/数据结构，然后让 main 返回一个可验证的结果

function main() {
}

const result = main();
console.log('main() 返回:', result);
`;
  const reference = `function main() {
  return 'hello mentor';
}

const result = main();
console.log('main() 返回:', result);
`;
  return {
    id: 'free-1',
    title: '先定接口',
    goal: '先想清楚输入输出再写代码',
    instructions: '写出 main 的输入/输出/数据结构，并让它返回一个可验证的结果。',
    brief: '先定接口不写逻辑：在注释里写清程序的输入、输出和中间数据结构，再让 main() 返回一个可验证的结果。',
    explain: '这一步是定接口——想清楚数据怎么进出，后面才不会写一半迷路。',
    skeleton,
    language: 'javascript',
    acceptance: { type: 'exit_zero' },
    hints: {
      L1: ['main 的输入和输出分别是什么？先用一句话写下来。'],
      L2: ['在 main 上方写注释：输入、输出、数据结构；让 main 返回一个非 null 的结果。'],
      L3: '伪代码：// 输入：…；// 输出：…；// 数据结构：…；function main() { return 最小可验证结果; }',
      L4: '先复述你项目的输入、输出和数据结构，再对照参考实现重写。',
    },
    reference,
  };
}

function freeTask2(goal: string): TaskNode {
  const skeleton = `// TODO: 实现 solve 的核心逻辑

function solve(input) {
}

const sample = solve('示例输入');
console.log('solve() 返回:', sample);
`;
  const reference = `function solve(input) {
  return input;
}

const sample = solve('示例输入');
console.log('solve() 返回:', sample);
`;
  return {
    id: 'free-2',
    title: '写主干逻辑',
    goal: '把会写落到实处：跑通简单例子',
    instructions: '实现 solve 的核心逻辑，让它能处理一个真实的小例子。',
    brief: '写主干：保住刚才的接口，实现 solve(input) 把输入变成输出，先让最普通的情况跑通。',
    explain: '程序的主体逻辑就在这里。先让它对，下一步再补边界让它全。',
    skeleton,
    language: 'javascript',
    acceptance: { type: 'exit_zero' },
    hints: {
      L1: ['solve 接收什么参数？它应该返回什么？先举一个小例子。'],
      L2: ['按你的注释，把「输入 → 处理 → 输出」写进 solve；先让最普通的输入跑通。'],
      L3: '伪代码：function solve(input) { 处理输入 → 得到中间结果 → return 最终结果; }',
      L4: '先复述你的算法步骤，再对照参考实现重写。',
    },
    reference,
  };
}

function freeTask3(goal: string): TaskNode {
  const skeleton = `// TODO: 处理空输入/非法输入/边界值

function validate() {
}

console.log('边界处理:', validate());
`;
  const reference = `function validate() {
  return true;
}

console.log('边界处理:', validate());
`;
  return {
    id: 'free-3',
    title: '补上边界防护',
    goal: '形成「先想边界，再交付」的工程习惯',
    instructions: '处理空输入、非法输入、极端值，最后让 validate() 返回 true。',
    brief: '补边界：空输入、非法输入、极端值会怎样？逐条写成检查，最后让 validate() 返回 true。',
    explain: '代码能跑只是及格，能扛住边界才算合格——这是完整程序的最后一层。',
    skeleton,
    language: 'javascript',
    acceptance: { type: 'exit_zero' },
    hints: {
      L1: ['这个项目在什么输入下会出问题？先列出 3 种。'],
      L2: ['把 3 种边界情况写成检查，逐条验证；无法用断言就打印出检查结果。'],
      L3: '伪代码：function validate() { 检查空输入…；检查非法输入…；检查极端值…；return true; }',
      L4: '先复述你列出的边界情况，再对照参考实现重写。',
    },
    reference,
  };
}
