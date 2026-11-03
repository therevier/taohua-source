import type { Language, ProjectPlan, TaskNode } from '../../shared/types';

/**
 * 内置兜底教学计划模板（「桃花源码」零基础教学版）。
 *
 * 教学法：先教，再练。每步只引入一个概念——
 * ① 概念（用生活比喻讲清楚）→ ② 可运行示例 → ③ 学生照抄/模仿 → ④ 运行验证 → ⑤ 讲解。
 *
 * 用途：
 * 1. 没配置 LLM Key 时直接使用，保证演示完全可用、可复现；
 * 2. 作为 LLM 计划的兜底——LLM 失败或质量闸门拒绝时，按关键词选模板。
 */

const PASS = '通过: true';

function byOutputContains(value: string): TaskNode['acceptance'] {
  return { type: 'output_contains', value };
}

export function buildFallbackPlan(goal: string): ProjectPlan {
  if (/python|词频|统计/i.test(goal)) return wordCounterPlan();
  if (/计算器|运算|calculator/i.test(goal)) return calculatorPlan();
  if (/待办|todo|清单|任务管理/i.test(goal)) return todoPlan();
  return freeformPlan(goal);
}

/* ------------------------------------------------------------------ */
/* 模板一：待办清单（JavaScript，零基础三步）                           */
/* ------------------------------------------------------------------ */

function todoPlan(): ProjectPlan {
  return {
    title: '待办清单小工具（JavaScript）',
    overview: '从零开始：先让程序说话，再学会用变量记住名字、用数组记住好几件事。',
    language: 'javascript',
    tasks: [todoTask1(), todoTask2(), todoTask3()],
  };
}

function todoTask1(): TaskNode {
  const skeleton = `// TODO: 照着示例写一行 console.log('你好，桃花源');
`;
  const reference = `console.log('你好，桃花源');
`;
  return {
    id: 'todo-1',
    title: '让程序说句话',
    goal: '理解「运行程序 → 看到输出」',
    concept: '输出文字：console.log',
    instructions: '写一行 console.log(\'你好，桃花源\'); 并运行。',
    brief: '先认识第一个概念：程序要「说话」才能让人看到结果。JavaScript 里让程序说话的写法是 console.log(\'要打出来的文字\')。示例代码在下面。现在你来写：在编辑区写一行 console.log(\'你好，桃花源\');，写完点「运行代码」，输出里出现「你好，桃花源」就对了，再点「提交本步」。',
    example: `console.log('你好，桃花源');`,
    explain: '你让程序说出了第一句话。以后每一步，我们都会用 console.log 把程序的结果打出来给你看——这是和程序对话的方式。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('你好，桃花源'),
    hints: {
      L1: ['程序要说出「你好，桃花源」，用哪个写法能让它说话？'],
      L2: ['看示例：console.log(...) 括号里放要打的文字。'],
      L3: '写法模板：console.log(\'你好，桃花源\');',
      L4: '复述：console.log 是干什么用的？然后对照示例重写。',
    },
    reference,
  };
}

function todoTask2(): TaskNode {
  const skeleton = `// TODO: 照着示例：定义 name 并打印「你好，小桃」
`;
  const reference = `const name = '小桃';
console.log('你好，' + name);
`;
  return {
    id: 'todo-2',
    title: '用变量记住名字',
    goal: '认识变量：给值贴标签',
    concept: '变量：const 名字 = 值',
    instructions: '定义 const name = \'小桃\'; 并打印「你好，小桃」。',
    brief: '这次学「变量」——可以理解成贴了标签的盒子，用来记住一个值。写法：const 名字 = \'值\';。示例代码在下面。现在写：先 const name = \'小桃\'; 再用 console.log(\'你好，\' + name); 把它打印出来，看到「你好，小桃」就对了。',
    example: `const name = '小桃';
console.log('你好，' + name);`,
    explain: '你用一个变量记住了名字，又把它打印了出来。变量是编程里最基本的东西——程序靠它记住数据。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('你好，小桃'),
    hints: {
      L1: ['盒子（变量）叫 name，里面装的是什么？怎么把盒子和一句话拼起来？'],
      L2: ['先写 const name = \'小桃\'; 再用 console.log(\'你好，\' + name); 把它打出来。'],
      L3: '写法模板：const name = \'小桃\'; console.log(\'你好，\' + name);',
      L4: '复述：变量是什么？为什么要把名字装进变量？然后对照示例重写。',
    },
    reference,
  };
}

function todoTask3(): TaskNode {
  const skeleton = `// TODO: 照着示例：定义 list 并打印「清单里有 2 件事」
`;
  const reference = `const list = ['买牛奶', '学 JavaScript'];
console.log('清单里有', list.length, '件事');
`;
  return {
    id: 'todo-3',
    title: '数组：一次记住好几样',
    goal: '认识数组与长度',
    concept: '数组：一串的值 + .length',
    instructions: '定义 list 数组并打印「清单里有 2 件事」。',
    brief: '最后学「数组」——一串按顺序排好的格子，能一次记住好几样东西。写法：const list = [\'买牛奶\', \'学 JavaScript\']; 数它的格子用 .length。示例代码在下面。现在写：先 const list = [\'买牛奶\', \'学 JavaScript\']; 再 console.log(\'清单里有\', list.length, \'件事\');，打出「清单里有 2 件事」就对了。',
    example: `const list = ['买牛奶', '学 JavaScript'];
console.log('清单里有', list.length, '件事');`,
    explain: '你写出了一个数组——待办清单的本质，就是把每件事放进这样的数组里。以后往数组里加、勾掉、筛选，都从这里开始。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('清单里有 2 件事'),
    hints: {
      L1: ['数组里放了几个东西？怎么让程序数出来？'],
      L2: ['用 .length 数数组里有多少个格子；console.log 可以一次打印好几段文字。'],
      L3: '写法模板：const list = [\'买牛奶\', \'学 JavaScript\']; console.log(\'清单里有\', list.length, \'件事\');',
      L4: '复述：数组和变量有什么不一样？.length 是干什么的？然后对照示例重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板二：计算器（JavaScript，零基础三步）                             */
/* ------------------------------------------------------------------ */

function calculatorPlan(): ProjectPlan {
  return {
    title: '四则运算计算器（JavaScript）',
    overview: '从零开始：让程序说话 → 认识数字与运算 → 学会用函数把算式包起来。',
    language: 'javascript',
    tasks: [calcTask1(), calcTask2(), calcTask3()],
  };
}

function calcTask1(): TaskNode {
  const skeleton = `// TODO: 照着示例写一行 console.log('计算器启动');
`;
  const reference = `console.log('计算器启动');
`;
  return {
    id: 'calc-1',
    title: '让程序说句话',
    goal: '理解「运行程序 → 看到输出」',
    concept: '输出文字：console.log',
    instructions: '写一行 console.log(\'计算器启动\'); 并运行。',
    brief: '先让程序说话。写法是 console.log(\'要打出来的文字\')，示例代码在下面。现在写：console.log(\'计算器启动\');，运行后输出里出现「计算器启动」就对了。',
    example: `console.log('计算器启动');`,
    explain: '程序能用 console.log 说话——这是你和程序交流的第一步。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('计算器启动'),
    hints: {
      L1: ['怎么让程序说出「计算器启动」？'],
      L2: ['看示例：console.log 括号里放要打的文字。'],
      L3: '写法模板：console.log(\'计算器启动\');',
      L4: '复述：console.log 是什么？然后对照示例重写。',
    },
    reference,
  };
}

function calcTask2(): TaskNode {
  const skeleton = `// TODO: 照着示例：定义 a、b 并打印「2 + 3 = 5」
`;
  const reference = `const a = 2;
const b = 3;
console.log('2 + 3 =', a + b);
`;
  return {
    id: 'calc-2',
    title: '数字与加法',
    goal: '认识变量与数学运算',
    concept: '变量装数字 + 相加运算',
    instructions: '定义 const a = 2; const b = 3; 并打印「2 + 3 = 5」。',
    brief: '这次学「变量 + 运算」：数字也能装进贴了标签的盒子，两个盒子可以相加。写法：const a = 2; const b = 3;。示例代码在下面。现在写：先定义 a、b，再用 console.log(\'2 + 3 =\', a + b); 打印出来，看到「2 + 3 = 5」就对了。',
    example: `const a = 2;
const b = 3;
console.log('2 + 3 =', a + b);`,
    explain: '你把两个数字装进变量，又让程序把它们加起来——计算器最核心的「运算」就是这一步。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('2 + 3 = 5'),
    hints: {
      L1: ['两个数字盒子怎么相加？打印时怎么把文字和结果拼在一起？'],
      L2: ['先 const a = 2; const b = 3; 再 console.log(\'2 + 3 =\', a + b);'],
      L3: '写法模板：const a = 2; const b = 3; console.log(\'2 + 3 =\', a + b);',
      L4: '复述：变量装数字和装文字有什么不同？然后对照示例重写。',
    },
    reference,
  };
}

function calcTask3(): TaskNode {
  const skeleton = `// TODO: 照着示例：写函数 add 并打印「通过: true」
`;
  const reference = `function add(a, b) {
  return a + b;
}
console.log('通过:', add(2, 3) === 5);
`;
  return {
    id: 'calc-3',
    title: '用函数把算式包起来',
    goal: '认识函数与返回值',
    concept: '函数：function 名字(参数) { return 结果; }',
    instructions: '写函数 add 并打印「通过: true」。',
    brief: '最后学「函数」——把一段能重复用的代码包成一个名字，之后叫名字就能用。写法：function 名字(参数) { return 结果; }。示例代码在下面。现在写：function add(a, b) { return a + b; } 再 console.log(\'通过:\', add(2, 3) === 5);，打出「通过: true」就对了。',
    example: `function add(a, b) {
  return a + b;
}
console.log('通过:', add(2, 3) === 5);`,
    explain: '你把加法包成了函数 add——之后想算别的数，只要换传入的数字。计算器的每个按钮，背后都是这样一个函数。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains(PASS),
    hints: {
      L1: ['函数要接收什么、返回什么？'],
      L2: ['写 function add(a, b) { return a + b; } 然后调用它验证。'],
      L3: '写法模板：function add(a, b) { return a + b; } console.log(\'通过:\', add(2, 3) === 5);',
      L4: '复述：函数和直接写算式有什么区别？然后对照示例重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板三：词频统计（Python，零基础三步）                               */
/* ------------------------------------------------------------------ */

function wordCounterPlan(): ProjectPlan {
  return {
    title: '词频统计小工具（Python）',
    overview: '从零开始：让程序说话 → 用变量记住文字 → 用列表装一串词。',
    language: 'python',
    tasks: [wcTask1(), wcTask2(), wcTask3()],
  };
}

function wcTask1(): TaskNode {
  const skeleton = `# TODO: 照着示例写一行 print('你好，桃花源')
`;
  const reference = `print('你好，桃花源')
`;
  return {
    id: 'wc-1',
    title: '让程序说句话',
    goal: '理解「运行程序 → 看到输出」',
    concept: '输出文字：print',
    instructions: '写一行 print(\'你好，桃花源\') 并运行。',
    brief: '先认识第一个概念：程序要「说话」才能让人看到结果。Python 里让程序说话的写法是 print(\'要打出来的文字\')。示例代码在下面。现在写一行：print(\'你好，桃花源\')，运行后输出里出现「你好，桃花源」就对了。',
    example: `print('你好，桃花源')`,
    explain: '你让程序说出了第一句话。之后每一步，我们都用 print 把结果打出来给你看。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains('你好，桃花源'),
    hints: {
      L1: ['Python 里让程序说话用哪个词？'],
      L2: ['看示例：print 括号里放要打的文字。'],
      L3: '写法模板：print(\'你好，桃花源\')',
      L4: '复述：print 是干什么的？然后对照示例重写。',
    },
    reference,
  };
}

function wcTask2(): TaskNode {
  const skeleton = `# TODO: 照着示例：定义 name 并打印「你好，小桃」
`;
  const reference = `name = '小桃'
print('你好，' + name)
`;
  return {
    id: 'wc-2',
    title: '用变量记住文字',
    goal: '认识变量',
    concept: '变量：名字 = 值',
    instructions: '定义 name = \'小桃\' 并打印「你好，小桃」。',
    brief: '这次学「变量」——一个贴了标签的盒子，用来记住一个值。写法：名字 = \'值\'。示例代码在下面。现在写：name = \'小桃\' 然后 print(\'你好，\' + name)，打出「你好，小桃」就对了。',
    example: `name = '小桃'
print('你好，' + name)`,
    explain: '你把名字装进了变量，又把它打印出来。程序靠变量记住数据。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains('你好，小桃'),
    hints: {
      L1: ['盒子（变量）里装的是什么？怎么把它和一句话拼起来？'],
      L2: ['先 name = \'小桃\' 再 print(\'你好，\' + name)。'],
      L3: '写法模板：name = \'小桃\'; print(\'你好，\' + name)',
      L4: '复述：变量是什么？为什么要把名字装进变量？然后对照示例重写。',
    },
    reference,
  };
}

function wcTask3(): TaskNode {
  const skeleton = `# TODO: 照着示例：定义 words 并打印「一共有 3 个词」
`;
  const reference = `words = ['the', 'cat', 'the']
print('一共有', len(words), '个词')
`;
  return {
    id: 'wc-3',
    title: '列表：一次记住好几样',
    goal: '认识列表与 len()',
    concept: '列表：一串的值 + len()',
    instructions: '定义 words 列表并打印「一共有 3 个词」。',
    brief: '最后学「列表」——一串按顺序排好的格子，能一次记住好几样东西。写法：words = [\'the\', \'cat\', \'the\']; 用 len(words) 数它有几样。示例代码在下面。现在写：先定义 words 列表，再 print(\'一共有\', len(words), \'个词\')，打出「一共有 3 个词」就对了。',
    example: `words = ['the', 'cat', 'the']
print('一共有', len(words), '个词')`,
    explain: '列表是 Python 里最常用的装东西的方式。词频统计的第一步，就是把句子拆成单词放进这样的列表里。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains('一共有 3 个词'),
    hints: {
      L1: ['列表里放了几个词？怎么让程序数出来？'],
      L2: ['用 len(words) 数列表里有几样；print 可以一次打印好几段。'],
      L3: '写法模板：words = [\'the\', \'cat\', \'the\']; print(\'一共有\', len(words), \'个词\')',
      L4: '复述：列表和变量有什么不一样？len 是干什么的？然后对照示例重写。',
    },
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* 模板四：自由项目（任意目标兜底，零基础通用三课）                      */
/* ------------------------------------------------------------------ */

function freeformPlan(goal: string): ProjectPlan {
  const shortGoal = goal.length > 30 ? `${goal.slice(0, 30)}…` : goal;
  return {
    title: `自由项目：${shortGoal}`,
    overview: `从零开始的三节小课：先让程序说话，再学会变量和数组——三课学完，你就有能力开始写「${shortGoal}」的第一版了。`,
    language: 'javascript',
    tasks: [todoTask1(), todoTask2(), todoTask3()],
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
    concept: '接口：程序的输入与输出',
    instructions: '写出 main 的输入/输出/数据结构，并让它返回一个可验证的结果。',
    brief: '先定接口不写逻辑：在注释里写清程序的输入、输出和中间数据结构，再让 main() 返回一个可验证的结果。',
    example: `function main() {
  return 'hello mentor';
}

const result = main();
console.log('main() 返回:', result);`,
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
    concept: '函数与返回值',
    instructions: '实现 solve 的核心逻辑，让它能处理一个真实的小例子。',
    brief: '写主干：保住刚才的接口，实现 solve(input) 把输入变成输出，先让最普通的情况跑通。',
    example: `function solve(input) {
  return input;
}

const sample = solve('示例输入');
console.log('solve() 返回:', sample);`,
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
    concept: '边界情况与防御性判断',
    instructions: '处理空输入、非法输入、极端值，最后让 validate() 返回 true。',
    brief: '补边界：空输入、非法输入、极端值会怎样？逐条写成检查，最后让 validate() 返回 true。',
    example: `function validate() {
  return true;
}

console.log('边界处理:', validate());`,
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

/* ------------------------------------------------------------------ */
/* 「继续完善」兜底扩展任务（LLM 扩展失败时使用）                        */
/* ------------------------------------------------------------------ */

export function buildExtensionFallback(projectTitle: string, language: Language): TaskNode[] {
  if (language === 'python') return [extPy1(), extPy2()];
  return [extJs1(projectTitle), extJs2(projectTitle)];
}

function extJs1(projectTitle: string): TaskNode {
  const skeleton = `// TODO: 照着示例写 newFeature 并打印「新功能完成」
`;
  const reference = `function newFeature() {
  return '新功能完成';
}
console.log(newFeature());
`;
  return {
    id: 'ext-fallback-1',
    title: '用函数装下新功能',
    goal: '认识函数：把功能包起来',
    concept: '函数：function 名字() { return 结果; }',
    instructions: '写函数 newFeature 并打印「新功能完成」。',
    brief: `给项目加新功能之前，先认识「函数」——一段可以重复使用的代码，用名字包起来。写法：function 名字() { return 结果; }。示例代码在下面。现在写：function newFeature() { return '新功能完成'; } 再 console.log(newFeature());，打出「新功能完成」就对了。`,
    example: `function newFeature() {
  return '新功能完成';
}
console.log(newFeature());`,
    explain: '你把新功能包成了函数 newFeature。函数让代码可以重复使用，也更容易组合。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('新功能完成'),
    hints: {
      L1: ['新功能要写成一个函数，函数最后要返回什么？'],
      L2: ['写 function newFeature() { return \'新功能完成\'; } 再调用它。'],
      L3: '写法模板：function newFeature() { return \'新功能完成\'; } console.log(newFeature());',
      L4: '复述：函数是什么？为什么要把它包起来？然后对照示例重写。',
    },
    reference,
  };
}

function extJs2(projectTitle: string): TaskNode {
  const skeleton = `// TODO: 照着示例：写 newFeature 并打印「整合成功: 新功能完成」
`;
  const reference = `function newFeature() {
  return '新功能完成';
}
console.log('整合成功:', newFeature());
`;
  return {
    id: 'ext-fallback-2',
    title: '把新功能接回项目',
    goal: '学会调用与组合',
    concept: '调用函数：用名字() 使用它',
    instructions: '调用 newFeature 并打印「整合成功: 新功能完成」。',
    brief: `把新功能接回「${projectTitle}」：先写 function newFeature() { return '新功能完成'; }，再调用它并打印出来。示例代码在下面。现在写：先定义 newFeature，再 console.log('整合成功:', newFeature());，打出「整合成功: 新功能完成」就对了。`,
    example: `function newFeature() {
  return '新功能完成';
}
console.log('整合成功:', newFeature());`,
    explain: '你把新功能和项目串起来了。以后再加功能，都用「写函数 → 调用 → 打印验证」这个套路。',
    skeleton,
    language: 'javascript',
    acceptance: byOutputContains('整合成功: 新功能完成'),
    hints: {
      L1: ['函数写好了，怎么让程序「用」它？'],
      L2: ['调用就是写 名字()；把调用结果放进 console.log 里打印。'],
      L3: '写法模板：console.log(\'整合成功:\', newFeature());',
      L4: '复述：函数定义和调用有什么区别？然后对照示例重写。',
    },
    reference,
  };
}

function extPy1(): TaskNode {
  const skeleton = `# TODO: 照着示例定义 new_feature 并打印「新功能完成」
`;
  const reference = `def new_feature():
    return '新功能完成'

print(new_feature())
`;
  return {
    id: 'ext-fallback-1',
    title: '用函数装下新功能',
    goal: '认识函数：把功能包起来',
    concept: '函数：def 名字(): return 结果',
    instructions: '定义 new_feature 并打印「新功能完成」。',
    brief: `给项目加新功能之前，先认识「函数」——一段可以重复使用的代码，用名字包起来。写法：def 名字(): return 结果。示例代码在下面。现在写：def new_feature(): return '新功能完成'，再 print(new_feature())，打出「新功能完成」就对了。`,
    example: `def new_feature():
    return '新功能完成'

print(new_feature())`,
    explain: '你把新功能包成了函数 new_feature。函数让代码可以重复使用，也更容易组合。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains('新功能完成'),
    hints: {
      L1: ['Python 里定义函数用什么词？函数最后要返回什么？'],
      L2: ['写 def new_feature(): return \'新功能完成\' 再调用它。'],
      L3: '写法模板：def new_feature(): return \'新功能完成\'；print(new_feature())',
      L4: '复述：函数是什么？为什么要把它包起来？然后对照示例重写。',
    },
    reference,
  };
}

function extPy2(): TaskNode {
  const skeleton = `# TODO: 照着示例：定义 new_feature 并打印「整合成功: 新功能完成」
`;
  const reference = `def new_feature():
    return '新功能完成'

print('整合成功:', new_feature())
`;
  return {
    id: 'ext-fallback-2',
    title: '把新功能接回项目',
    goal: '学会调用与组合',
    concept: '调用函数：用名字() 使用它',
    instructions: '调用 new_feature 并打印「整合成功: 新功能完成」。',
    brief: `把新功能接回项目：先写 def new_feature(): return '新功能完成'，再调用它并打印出来。示例代码在下面。现在写：先定义 new_feature，再 print('整合成功:', new_feature())，打出「整合成功: 新功能完成」就对了。`,
    example: `def new_feature():
    return '新功能完成'

print('整合成功:', new_feature())`,
    explain: '你把新功能和项目串起来了。以后再加功能，都用「写函数 → 调用 → 打印验证」这个套路。',
    skeleton,
    language: 'python',
    acceptance: byOutputContains('整合成功: 新功能完成'),
    hints: {
      L1: ['函数写好了，怎么让程序「用」它？'],
      L2: ['调用就是写 名字()；把调用结果放进 print 里打印。'],
      L3: '写法模板：print(\'整合成功:\', new_feature())',
      L4: '复述：函数定义和调用有什么区别？然后对照示例重写。',
    },
    reference,
  };
}
