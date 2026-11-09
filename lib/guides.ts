/** Long-form copy for the skill guides, the score page and the FAQ. Part counts and timings match the converted tests. */
import type { Lang } from "./dict";
import type { Skill } from "./types";

type L = Record<Lang, string>;

export interface GuidePart {
  label: string;
  name: string;
  /** Practice-matrix part number, used to link to the part in a sample test. */
  n: number;
  questions?: number;
  time: L;
  what: L;
}

export interface SkillGuide {
  title: L;
  description: L;
  h1: L;
  intro: L;
  facts: { label: L; value: L }[];
  parts: GuidePart[];
  tips: Record<Lang, string[]>;
  scoring: L;
}

export const GUIDE_SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];

export const SKILL_GUIDES: Record<Skill, SkillGuide> = {
  listening: {
    title: { zh: "CELPIP 听力题型、时间与技巧：6 个 Part 详解", en: "CELPIP Listening Test: Format, Timing and Tips" },
    description: {
      zh: "CELPIP 听力共 6 个 Part、38 道题，约 46–55 分钟。逐一讲解每个 Part 的题型、录音长度和答题技巧，并提供多套模考题免费在线练习。",
      en: "The CELPIP Listening test has 6 parts and 38 questions in about 46–55 minutes. Part-by-part format, recording lengths and tips, with free online practice tests.",
    },
    h1: { zh: "CELPIP 听力：题型、时间与技巧", en: "CELPIP Listening: format, timing and tips" },
    intro: {
      zh: "听力是 CELPIP-General 的第一部分。每段录音只播放一次，不能暂停或回放；多数题目在录音结束后才出现，所以边听边记笔记非常关键。听力里会夹带不计分的试验题，格式和正式题一样、分辨不出来，所以总时长有浮动，每题都要认真做。",
      en: "Listening is the first section of the CELPIP-General test. Every recording plays once, with no pausing or replay, and most questions only appear after the recording ends, so note-taking matters. The section includes unscored trial questions that look exactly like scored ones, which is why the total time varies, so treat every question as if it counts.",
    },
    facts: [
      { label: { zh: "题数", en: "Questions" }, value: { zh: "38 题，6 个 Part", en: "38 questions in 6 parts" } },
      { label: { zh: "时间", en: "Time" }, value: { zh: "约 46–55 分钟", en: "About 46–55 minutes" } },
      { label: { zh: "题型", en: "Format" }, value: { zh: "单项选择，录音只播一次", en: "Multiple choice, audio plays once" } },
    ],
    parts: [
      {
        label: "Part 1", name: "Listening to Problem Solving", n: 1, questions: 8,
        time: { zh: "3 段录音，每段约 1–1.5 分钟", en: "3 sections, about 1–1.5 minutes each" },
        what: {
          zh: "一段两人对话分 3 段播放，每段后面 2–3 题。通常是一个人遇到问题，另一个人帮忙解决。题目会用语音读出来。",
          en: "A conversation played in three sections, with two or three questions after each. Usually one person has a problem and the other helps. Questions are read aloud.",
        },
      },
      {
        label: "Part 2", name: "Listening to a Daily Life Conversation", n: 2, questions: 5,
        time: { zh: "录音约 1.5–2 分钟", en: "Recording about 1.5–2 minutes" },
        what: { zh: "一段日常生活对话，比如邻居、朋友或同事之间，听完回答 5 题。", en: "An everyday conversation, for example between neighbours, friends or co-workers, followed by five questions." },
      },
      {
        label: "Part 3", name: "Listening for Information", n: 3, questions: 6,
        time: { zh: "录音约 2–3 分钟", en: "Recording about 2–3 minutes" },
        what: { zh: "一段以传递信息为主的对话，比如咨询服务或介绍活动，听完回答 6 题，重点是细节。", en: "A conversation where one person gives information, such as about a service or an event, followed by six detail questions." },
      },
      {
        label: "Part 4", name: "Listening to a News Item", n: 4, questions: 5,
        time: { zh: "录音约 1.5 分钟", en: "Recording about 1.5 minutes" },
        what: { zh: "一段新闻报道，听完用下拉选项补全 5 个句子。", en: "A short news report, followed by five sentences to complete from drop-down options." },
      },
      {
        label: "Part 5", name: "Listening to a Discussion", n: 5, questions: 8,
        time: { zh: "视频约 1.5–2 分钟", en: "Video about 1.5–2 minutes" },
        what: { zh: "一段多人讨论的视频，看完回答 8 题，需要分清谁说了什么、谁持什么立场。", en: "A video of several people in discussion, followed by eight questions. You need to track who said what and who holds which view." },
      },
      {
        label: "Part 6", name: "Listening for Viewpoints", n: 6, questions: 6,
        time: { zh: "录音约 3 分钟", en: "Recording about 3 minutes" },
        what: { zh: "一段演讲或报道，介绍某个问题上的不同观点，听完回答 6 题，考察对观点和态度的理解。", en: "A talk or report presenting views on an issue, followed by six questions about the opinions and attitudes expressed." },
      },
    ],
    tips: {
      zh: [
        "边听边记关键词：人物、时间、地点、数字，以及 but、however、actually 这类转折词。",
        "留意说话人改口：先提一个方案、后来又改主意时，答案通常是最后那个。",
        "Part 1 的题目是用语音读出的，听题时就开始排除明显不对的选项。",
        "Part 5 要盯住每个人的立场，题目常问谁同意、谁反对、谁提出了什么建议。",
        "听力按答对题数计分，答错不倒扣，所以每题都要选一个答案。",
        "练习时先限时听一遍作答，再打开原文对照，把没听懂的句子单独多听几遍。",
      ],
      en: [
        "Note key words as you listen: people, times, places, numbers, and turn words like but, however and actually.",
        "Watch for changes of mind. When a speaker suggests one plan and then switches, the answer is usually the final one.",
        "Part 1 questions are read aloud. Start ruling out options while you hear the question.",
        "In Part 5, track each person's position. Questions often ask who agrees, who objects or who suggested something.",
        "Wrong answers don't cost points, so always choose an answer.",
        "Practise once under time pressure, then open the transcript and replay the sentences you missed.",
      ],
    },
    scoring: {
      zh: "听力按答对题数换算成 CELPIP 等级（0–12）。CELPIP 没有公布官方换算表，常见的估算是答对 27 题左右约为 7 级、33 题左右约为 9 级。",
      en: "Listening is scored by the number of correct answers, converted to a CELPIP level (0–12). CELPIP doesn't publish the conversion table; common estimates put about 27 correct at level 7 and about 33 at level 9.",
    },
  },

  reading: {
    title: { zh: "CELPIP 阅读题型、时间与技巧：4 个 Part 详解", en: "CELPIP Reading Test: Format, Timing and Tips" },
    description: {
      zh: "CELPIP 阅读共 4 个 Part、38 道题，约 43–56 分钟，每个 Part 单独计时。详解信件、图表、信息和观点四类题型与答题技巧，附多套模考题免费练习。",
      en: "The CELPIP Reading test has 4 parts and 38 questions in about 43–56 minutes, each part timed separately. Format and tips for every part, with free online practice tests.",
    },
    h1: { zh: "CELPIP 阅读：题型、时间与技巧", en: "CELPIP Reading: format, timing and tips" },
    intro: {
      zh: "阅读是 CELPIP-General 的第二部分，紧接在听力之后。4 个 Part 各自计时，时间到自动进入下一部分，不能回头修改。文章在左边，题目在右边同时显示，从下拉选项中选答案。和听力一样，阅读里也有分辨不出来的不计分试验题。",
      en: "Reading is the second section of the CELPIP-General test, right after Listening. Each of the four parts has its own timer and moves on automatically when time runs out, with no going back. The passage is on the left and all the questions appear on the right, answered from drop-down options. As in Listening, some unscored trial questions are mixed in.",
    },
    facts: [
      { label: { zh: "题数", en: "Questions" }, value: { zh: "38 题，4 个 Part", en: "38 questions in 4 parts" } },
      { label: { zh: "时间", en: "Time" }, value: { zh: "约 43–56 分钟", en: "About 43–56 minutes" } },
      { label: { zh: "题型", en: "Format" }, value: { zh: "从下拉选项中选答案", en: "Drop-down answer choices" } },
    ],
    parts: [
      {
        label: "Part 1", name: "Reading Correspondence", n: 1, questions: 11,
        time: { zh: "11 分钟", en: "11 minutes" },
        what: { zh: "先读一封信或邮件，回答 6 道理解题；再读一封回信，补全其中 5 处空。", en: "Read a letter or email and answer six questions, then complete five gaps in a reply." },
      },
      {
        label: "Part 2", name: "Reading to Apply a Diagram", n: 2, questions: 8,
        time: { zh: "9 分钟", en: "9 minutes" },
        what: { zh: "一张图表（如广告、日程或价目表）配一封邮件。根据图表补全邮件里的 5 处空，再回答 3 道题。", en: "A diagram such as an ad, schedule or price list, plus an email. Use the diagram to fill five gaps in the email, then answer three questions." },
      },
      {
        label: "Part 3", name: "Reading for Information", n: 3, questions: 9,
        time: { zh: "10 分钟", en: "10 minutes" },
        what: { zh: "一篇分为 A–D 四段的说明文。判断 9 个句子分别出自哪一段，或者文中没有提到（E）。", en: "An informational passage in paragraphs A–D. Decide which paragraph each of nine statements comes from, or E if it isn't in the passage." },
      },
      {
        label: "Part 4", name: "Reading for Viewpoints", n: 4, questions: 10,
        time: { zh: "13 分钟", en: "13 minutes" },
        what: { zh: "一篇观点类文章，先回答 5 道理解题，再补全一条读者评论里的 5 处空。", en: "An opinion article with five questions, then a reader's comment with five gaps to complete." },
      },
    ],
    tips: {
      zh: [
        "先扫一遍题目再读文章，带着问题找信息，不要逐字精读。",
        "Part 2 要把邮件里的条件（预算、时间、人数、要求）逐条对照图表，答案往往卡在一个细节上。",
        "Part 3 的 E 表示文中没有提到。不要为了让每一段都被选到而硬凑。",
        "补全空格时把整句读完再选，注意语法搭配和前后文的逻辑。",
        "每个 Part 都单独计时，难题先选一个答案往下做，别在一道题上耗光时间。",
        "Part 4 注意区分作者本人的观点和文章里引用的别人的观点。",
      ],
      en: [
        "Skim the questions first, then read with them in mind instead of reading every word.",
        "In Part 2, check each condition in the email (budget, time, number of people, requirements) against the diagram. Answers often turn on one detail.",
        "In Part 3, E means the statement isn't in the passage. Don't force every paragraph to be used.",
        "For gap fills, read the whole sentence before choosing, and check grammar and logic.",
        "Each part has its own timer. Pick an answer on hard questions and move on.",
        "In Part 4, separate the author's own view from views the article quotes.",
      ],
    },
    scoring: {
      zh: "阅读和听力一样，按答对题数换算成 CELPIP 等级，答错不倒扣。常见估算是答对 24 题左右约为 7 级、31 题左右约为 9 级。",
      en: "Like Listening, Reading is scored by the number of correct answers, with no penalty for wrong ones. Common estimates put about 24 correct at level 7 and about 31 at level 9.",
    },
  },

  writing: {
    title: { zh: "CELPIP 写作题型、评分标准与技巧：邮件和调查问卷", en: "CELPIP Writing Test: Email and Survey Tasks, Scoring and Tips" },
    description: {
      zh: "CELPIP 写作共 2 题：27 分钟写邮件、26 分钟回答调查问卷，各 150–200 词。讲解评分维度、结构和常见失分点，附范文和在线限时练习。",
      en: "CELPIP Writing has two tasks: an email in 27 minutes and a survey response in 26 minutes, 150–200 words each. Scoring criteria, structure and common mistakes, with sample responses and timed practice.",
    },
    h1: { zh: "CELPIP 写作：题型、评分与技巧", en: "CELPIP Writing: format, scoring and tips" },
    intro: {
      zh: "写作是 CELPIP-General 的第三部分，两道题都在电脑上打字完成。界面有计时器、字数统计和拼写检查。两道题分别计时，时间到自动提交。",
      en: "Writing is the third section of the CELPIP-General test. Both tasks are typed on the computer. The screen has a timer, a word counter and a spell checker, and each task is timed and submitted automatically.",
    },
    facts: [
      { label: { zh: "题数", en: "Tasks" }, value: { zh: "2 题", en: "2 tasks" } },
      { label: { zh: "时间", en: "Time" }, value: { zh: "53 分钟", en: "53 minutes" } },
      { label: { zh: "字数", en: "Length" }, value: { zh: "每题 150–200 词", en: "150–200 words each" } },
    ],
    parts: [
      {
        label: "Task 1", name: "Writing an Email", n: 1,
        time: { zh: "27 分钟", en: "27 minutes" },
        what: { zh: "根据一个生活或工作场景写一封邮件，题目会给出 3 个必须写到的要点。收信人可能是朋友、房东、经理或市政府。", en: "Write an email about an everyday or work situation, covering the three points listed. The reader might be a friend, a landlord, a manager or the city." },
      },
      {
        label: "Task 2", name: "Responding to Survey Questions", n: 2,
        time: { zh: "26 分钟", en: "26 minutes" },
        what: { zh: "一份调查问卷给出两个选项，选择其中一个并说明理由。", en: "A survey offers two options. Choose one and explain why." },
      },
    ],
    tips: {
      zh: [
        "邮件题的 3 个要点要逐一写到，每个要点单独成段最清楚，漏一个会直接影响任务完成度。",
        "按收信人决定语气：给朋友可以轻松，给经理、房东或政府部门要礼貌、正式。",
        "调查题开头就明确选 A 还是 B，再给 2–3 个理由，每个理由配一个具体例子，结尾呼应立场。",
        "调查题可以顺带说一下另一个选项的不足，但别写成两边都好、没有立场。",
        "控制在 150–200 词。太短会失分，太长会挤掉检查时间。",
        "最后留 2–3 分钟检查时态、标点和用词。拼写检查只能标出拼错的词，用错的词和语法问题要靠自己。",
      ],
      en: [
        "Cover all three points in the email, ideally one paragraph each. Missing one hurts task fulfillment.",
        "Match the tone to the reader: relaxed for a friend, polite and formal for a manager, landlord or the city.",
        "In the survey task, state your choice in the first sentence, give two or three reasons with a concrete example each, and restate your position at the end.",
        "You can point out a weakness of the other option, but don't sit on the fence.",
        "Stay within 150–200 words. Too short loses marks; too long leaves no time to check.",
        "Keep two or three minutes to check tenses, punctuation and word choice. The spell checker only catches misspellings, not wrong words or grammar.",
      ],
    },
    scoring: {
      zh: "写作由至少 3 名受过培训和认证的评分员打分，评分维度是：内容与连贯性、词汇、可读性和任务完成度，最后给出 0–12 的等级。",
      en: "Writing is rated by at least three trained, certified raters on four dimensions: content and coherence, vocabulary, readability, and task fulfillment. The result is a level from 0 to 12.",
    },
  },

  speaking: {
    title: { zh: "CELPIP 口语 8 个 Task 详解：准备时间、答题结构与技巧", en: "CELPIP Speaking Test: All 8 Tasks, Timing and Tips" },
    description: {
      zh: "CELPIP 口语共 8 个 Task，约 15 分钟，对着电脑录音作答。逐一讲解每个 Task 的准备和作答时间、答题结构与评分维度，附范例和在线录音练习。",
      en: "CELPIP Speaking has 8 tasks in about 15 minutes, recorded on the computer. Prep and speaking time for each task, how to structure answers, scoring criteria, sample responses and recorded practice.",
    },
    h1: { zh: "CELPIP 口语：8 个 Task 与答题技巧", en: "CELPIP Speaking: the 8 tasks and how to answer" },
    intro: {
      zh: "口语是 CELPIP-General 的最后一部分。没有考官，你对着电脑麦克风作答，系统自动计时并录音，之后交给评分员打分。每个 Task 都有一段准备时间和一段作答时间，时间到自动进入下一题。正式题目之前有一道不计分的练习题。",
      en: "Speaking is the last section of the CELPIP-General test. There's no examiner: you answer into the computer's microphone, and the system times and records each response for raters to score. Each task has preparation time and speaking time, then moves on automatically. An unscored practice task comes first.",
    },
    facts: [
      { label: { zh: "题数", en: "Tasks" }, value: { zh: "8 个 Task 和 1 道练习题", en: "8 tasks plus a practice task" } },
      { label: { zh: "时间", en: "Time" }, value: { zh: "约 15 分钟", en: "About 15 minutes" } },
      { label: { zh: "形式", en: "Format" }, value: { zh: "对着电脑录音", en: "Recorded on the computer" } },
    ],
    parts: [
      { label: "Task 1", name: "Giving Advice", n: 1, time: { zh: "准备 30 秒，作答 90 秒", en: "30 s prep, 90 s speaking" }, what: { zh: "朋友或家人遇到一个情况，给出具体的建议并说明理由。", en: "A friend or family member is in a situation. Give specific advice and explain why." } },
      { label: "Task 2", name: "Talking about a Personal Experience", n: 2, time: { zh: "准备 30 秒，作答 60 秒", en: "30 s prep, 60 s speaking" }, what: { zh: "讲一段亲身经历：什么时候、发生了什么、结果和感受。", en: "Describe something that happened to you: when, what happened, how it ended and how you felt." } },
      { label: "Task 3", name: "Describing a Scene", n: 3, time: { zh: "准备 30 秒，作答 60 秒", en: "30 s prep, 60 s speaking" }, what: { zh: "向看不到图片的人描述图中场景：人物、动作和环境。", en: "Describe a picture to someone who can't see it: the people, what they're doing and the setting." } },
      { label: "Task 4", name: "Making Predictions", n: 4, time: { zh: "准备 30 秒，作答 60 秒", en: "30 s prep, 60 s speaking" }, what: { zh: "根据图片预测接下来最可能发生什么。", en: "Look at a picture and predict what will most likely happen next." } },
      { label: "Task 5", name: "Comparing and Persuading", n: 5, time: { zh: "先选择选项，再准备 60 秒、作答 60 秒", en: "Choose an option, then 60 s prep, 60 s speaking" }, what: { zh: "先从两个选项中选一个，然后对方提出另一个选项，你要说服对方你的选择更好。", en: "Pick one of two options. The other person suggests a different one, and you persuade them yours is better." } },
      { label: "Task 6", name: "Dealing with a Difficult Situation", n: 6, time: { zh: "准备 60 秒，作答 60 秒", en: "60 s prep, 60 s speaking" }, what: { zh: "面对一个两难处境，在两种做法里选一个，并对相关的人说出来。", en: "Facing a dilemma, choose one of two actions and say it to the person involved." } },
      { label: "Task 7", name: "Expressing Opinions", n: 7, time: { zh: "准备 30 秒，作答 90 秒", en: "30 s prep, 90 s speaking" }, what: { zh: "就一个社会话题表明立场，并给出理由和例子。", en: "Give your opinion on a social issue, with reasons and examples." } },
      { label: "Task 8", name: "Describing an Unusual Situation", n: 8, time: { zh: "准备 30 秒，作答 60 秒", en: "30 s prep, 60 s speaking" }, what: { zh: "看到一件不寻常的物品或场景，向看不到它的人（通常在电话里）描述清楚。", en: "Describe an unusual object or situation to someone who can't see it, often on the phone." } },
    ],
    tips: {
      zh: [
        "准备时间只记关键词，不要写完整句子，否则开口时会照着念、不自然。",
        "通用结构：第一句直接回答问题，中间给 2–3 个理由或细节，最后一句总结。",
        "把作答时间用满比说得快更重要，长时间停顿会影响流利度和内容得分。",
        "Task 3 和 Task 8 想象对方看不到画面，按从左到右或从前到后的顺序描述，用上位置词。",
        "Task 5 和 Task 6 是对着具体的人说话，开头可以直接称呼对方，语气要符合关系。",
        "练习时录音回放，再和范例对比用词、结构和语速。",
      ],
      en: [
        "During prep, jot down key words only. Writing full sentences leads to reading aloud and sounding stiff.",
        "A structure that works for most tasks: answer directly, give two or three reasons or details, then wrap up.",
        "Filling the time matters more than speaking fast. Long pauses hurt fluency and content.",
        "In Tasks 3 and 8 the listener can't see the picture. Describe in a clear order, left to right or front to back, using position words.",
        "In Tasks 5 and 6 you're talking to a specific person. Address them directly and match the tone to the relationship.",
        "Record yourself, play it back, and compare word choice, structure and pace with the sample responses.",
      ],
    },
    scoring: {
      zh: "口语由至少 3 名受过培训和认证的评分员打分，评分维度是：内容与连贯性、词汇、可听度和任务完成度，最后给出 0–12 的等级。",
      en: "Speaking is rated by at least three trained, certified raters on four dimensions: content and coherence, vocabulary, listenability, and task fulfillment. The result is a level from 0 to 12.",
    },
  },
};

export const LEVELS: { level: string; clb: string; desc: L }[] = [
  { level: "12", clb: "12", desc: { zh: "在高要求的社交、教育或工作场景中达到专家水平", en: "Expert proficiency in high-stakes social, educational, or workplace contexts" } },
  { level: "11", clb: "11", desc: { zh: "在高要求的社交、教育或工作场景中达到高级水平", en: "Advanced proficiency in high-stakes social, educational, or workplace contexts" } },
  { level: "10", clb: "10", desc: { zh: "在部分高要求的社交、教育或工作场景中非常有效", en: "Highly effective proficiency in some high-stakes social, educational, or workplace contexts" } },
  { level: "9", clb: "9", desc: { zh: "在部分高要求的社交、教育或工作场景中有效", en: "Effective proficiency in some high-stakes social, educational, or workplace contexts" } },
  { level: "8", clb: "8", desc: { zh: "在较高要求的社交、教育或工作场景中水平良好", en: "Good proficiency in more demanding social, educational, or workplace contexts" } },
  { level: "7", clb: "7", desc: { zh: "在有一定要求的社交、教育或工作场景中水平合格", en: "Adequate proficiency in somewhat demanding social, educational, or workplace contexts" } },
  { level: "6", clb: "6", desc: { zh: "在日常社交、教育或工作场景中水平发展中", en: "Developing proficiency in everyday social, educational, or workplace contexts" } },
  { level: "5", clb: "5", desc: { zh: "在日常社交、教育或工作场景中初步具备能力", en: "Acquiring proficiency in everyday social, educational, or workplace contexts" } },
  { level: "4", clb: "4", desc: { zh: "足以应付日常生活", en: "Adequate proficiency for daily life activities" } },
  { level: "3", clb: "3", desc: { zh: "在有限场景中具备一定能力", en: "Some proficiency in limited contexts" } },
  { level: "2", clb: "1–2", desc: { zh: "只能应付与眼前需要相关的场景", en: "Limited ability in contexts related to immediate needs" } },
  { level: "0–1", clb: "—", desc: { zh: "信息不足以评估", en: "Insufficient information to assess" } },
];

export const PROGRAMS: { name: L; need: L }[] = [
  { name: { zh: "联邦技术移民（FSW）", en: "Federal Skilled Worker (FSW)" }, need: { zh: "听说读写四项都达到 CLB 7", en: "CLB 7 in all four skills" } },
  { name: { zh: "加拿大经验类（CEC）", en: "Canadian Experience Class (CEC)" }, need: { zh: "TEER 0、1 类职业 CLB 7；TEER 2、3 类职业 CLB 5", en: "CLB 7 for TEER 0 or 1 jobs; CLB 5 for TEER 2 or 3 jobs" } },
  { name: { zh: "联邦技工移民（FST）", en: "Federal Skilled Trades (FST)" }, need: { zh: "听和说 CLB 5，读和写 CLB 4", en: "CLB 5 in listening and speaking, CLB 4 in reading and writing" } },
  { name: { zh: "加拿大入籍（18–54 岁）", en: "Canadian citizenship (ages 18–54)" }, need: { zh: "听和说 CLB 4。CELPIP-General 或只考听说的 CELPIP-General LS 都可以，过期成绩也接受", en: "CLB 4 in listening and speaking. CELPIP-General or the listening-and-speaking CELPIP-General LS both count, even if expired" } },
];

export const FAQ: { q: L; a: L }[] = [
  {
    q: { zh: "CELPIP 是什么考试？", en: "What is the CELPIP test?" },
    a: {
      zh: "CELPIP（思培）是加拿大的英语水平考试，由 Paragon Testing Enterprises 主办。CELPIP-General 考听说读写四项，加拿大移民局（IRCC）认可用于永久居民申请；CELPIP-General LS 只考听和说，用于入籍申请。",
      en: "CELPIP is a Canadian English proficiency test run by Paragon Testing Enterprises. CELPIP-General covers listening, reading, writing and speaking and is accepted by IRCC for permanent residence. CELPIP-General LS covers only listening and speaking and is used for citizenship.",
    },
  },
  {
    q: { zh: "CELPIP 考试一共多长时间？", en: "How long is the CELPIP test?" },
    a: {
      zh: "CELPIP-General 不到 3 小时，全程在电脑上一次考完，没有单独的口语场次。顺序是听力（46–55 分钟）、阅读（43–56 分钟）、写作（53 分钟）、口语（15 分钟）。听力和阅读的时长有浮动，是因为里面夹带不计分的试验题。只考听说的 CELPIP-General LS 大约 1 小时。",
      en: "CELPIP-General takes under 3 hours in one sitting on a computer, with no separate speaking session: Listening (46–55 minutes), Reading (43–56), Writing (53) and Speaking (15). Listening and Reading vary because they include unscored trial questions. The listening-and-speaking CELPIP-General LS takes about an hour.",
    },
  },
  {
    q: { zh: "CELPIP 怎么评分？", en: "How is CELPIP scored?" },
    a: {
      zh: "每项单独给出 0–12 的等级（以前 0–2 级统一显示为 M）。听力和阅读由电脑判分，按答对题数换算，答错不倒扣；写作和口语各由至少 3 名评分员按内容与连贯性、词汇、可读性或可听度、任务完成度四个维度打分。CELPIP 3–12 级和加拿大语言基准 CLB 3–12 一一对应。",
      en: "Each skill gets its own level from 0 to 12 (levels 0–2 used to be reported as M). Listening and Reading are computer-scored from correct answers, with no penalty for wrong ones. Writing and Speaking are each rated by at least three raters on content and coherence, vocabulary, readability or listenability, and task fulfillment. CELPIP levels 3–12 match CLB levels 3–12 one to one.",
    },
  },
  {
    q: { zh: "CELPIP 和雅思有什么区别？", en: "How is CELPIP different from IELTS?" },
    a: {
      zh: "IRCC 认可的英语考试有 CELPIP-General、雅思 General Training 和 PTE Core。CELPIP 全程在电脑上一次考完，口语对着电脑录音；雅思口语是和考官面对面，可能和其他科目不在同一天。CELPIP 只用一种北美口音，场景都是日常生活，成绩直接给 CELPIP 等级，和 CLB 一一对应；雅思是 0–9 分，需要查表换算成 CLB。",
      en: "IRCC accepts CELPIP-General, IELTS General Training and PTE Core for English. CELPIP is taken in one sitting on a computer and speaking is recorded; IELTS speaking is face to face with an examiner, sometimes on a different day. CELPIP uses a single North American accent and everyday situations, and its levels match CLB levels directly, while IELTS bands (0–9) need a conversion table.",
    },
  },
  {
    q: { zh: "移民需要 CELPIP 多少分？", en: "What CELPIP score do I need for immigration?" },
    a: {
      zh: "看项目：联邦技术移民要求四项都达到 CLB 7；加拿大经验类按职业类别要求 CLB 7 或 CLB 5；入籍要求听和说 CLB 4。在快速通道（Express Entry）里，语言分越高 CRS 分越高：单身申请人每项从 CLB 8 的 23 分升到 CLB 9 的 31 分，四项都达到 CLB 9 后，学历和海外工作经验的技能可转移分也翻倍。具体以 IRCC 官网的最新要求为准。",
      en: "It depends on the program: Federal Skilled Worker needs CLB 7 in all four skills, the Canadian Experience Class needs CLB 7 or CLB 5 depending on the job, and citizenship needs CLB 4 in listening and speaking. In Express Entry, higher scores earn more CRS points: for a single applicant each ability goes from 23 points at CLB 8 to 31 at CLB 9, and reaching CLB 9 in all four doubles the skill-transferability points for education and foreign work experience. Always check IRCC for the current requirements.",
    },
  },
  {
    q: { zh: "CELPIP 成绩多久出来？有效期多长？", en: "When do CELPIP results come out, and how long are they valid?" },
    a: {
      zh: "CELPIP 官网写的是考后 2–4 个工作日（不含周末和节假日）在 CELPIP 账户里公布，出分后会发邮件通知，成绩单以 PDF 下载。成绩自成绩单签发之日起 2 年有效：IRCC 要求创建快速通道档案和递交永居申请时，成绩都不超过 2 年。入籍申请则接受过期的 CELPIP 成绩。",
      en: "CELPIP says scores are posted to your CELPIP account 2–4 business days after the test (weekends and holidays don't count), with an email when they're ready and the score report as a PDF download. Scores are valid for two years from the date the report is issued: IRCC requires them to be under two years old both when you create your Express Entry profile and when you apply for permanent residence. Citizenship applications accept expired CELPIP results.",
    },
  },
  {
    q: { zh: "这个网站的题目是从哪里来的？", en: "Where do the questions on this site come from?" },
    a: {
      zh: "题目来自 CELPIP 官方练习材料，版权归 Paragon Testing Enterprises 所有。本网站是非官方的免费备考工具，与 Paragon 和 CELPIP 没有关联，报名请前往 CELPIP 官网。",
      en: "The questions come from official CELPIP practice materials, © Paragon Testing Enterprises. This is a free, unofficial study tool and isn't affiliated with Paragon or CELPIP. To book the test, go to the official CELPIP website.",
    },
  },
  {
    q: { zh: "网站给出的等级准吗？", en: "How accurate is the level this site shows?" },
    a: {
      zh: "听力和阅读的等级是按常见估算表从答对题数换算的，只能作为参考，官方没有公布换算表。写作和口语目前提供范文和范例供你对照，暂不自动打分。",
      en: "Listening and Reading levels come from a commonly cited estimate table, since CELPIP doesn't publish one, so treat them as a guide. For Writing and Speaking the site shows sample responses to compare against, with no automatic score yet.",
    },
  },
  {
    q: { zh: "我的练习记录和录音会上传吗？", en: "Are my answers and recordings uploaded?" },
    a: {
      zh: "不会。练习记录保存在你浏览器的 localStorage，口语录音保存在 IndexedDB，都只在你自己的设备上。清除浏览器数据会一并删除。",
      en: "No. Your history is stored in your browser's localStorage and your speaking recordings in IndexedDB, both only on your device. Clearing browser data deletes them.",
    },
  },
  {
    q: { zh: "需要注册或付费吗？", en: "Do I need an account, or to pay?" },
    a: {
      zh: "不需要。打开网页就能用，所有功能免费。口语部分需要允许浏览器使用麦克风，建议戴耳机。",
      en: "No. It works straight in the browser and everything is free. Speaking needs microphone access, and headphones are recommended.",
    },
  },
];
