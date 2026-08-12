// 云函数 ai：唯一 AI 入口（classify / chat / report）
// 阶段 4a：先打通 DeepSeek 通路（ping + test）
// 🔐 隐私红线：API key 只从云函数环境变量读取，绝不写进代码、绝不出现在 GitHub

const https = require('https');

const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_PATH = '/chat/completions';
const MODEL = 'deepseek-chat';

// key 从云函数环境变量读取（云开发控制台 → 云函数 → ai → 配置 → 环境变量）
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 调用 DeepSeek（OpenAI 兼容接口）
function callDeepSeek(messages, opts = {}) {
  const { temperature = 0.7, maxTokens = 800 } = opts;
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    });
    const req = https.request({
      host: DEEPSEEK_HOST,
      path: DEEPSEEK_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 15000 // 15 秒：客户端 callFunction 等待有上限（开发者工具更短），超了就快速失败返回明确错误，前端会重试一次，避免拖到客户端超时断开发 -504003
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) {
            return reject(new Error(data.error.message || 'DeepSeek 返回错误'));
          }
          const msg = data.choices && data.choices[0] && data.choices[0].message;
          resolve(msg ? msg.content : '');
        } catch (e) {
          reject(new Error('解析 DeepSeek 返回失败：' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('请求 DeepSeek 超时')); });
    req.write(payload);
    req.end();
  });
}

exports.main = async (event) => {
  const { mode } = event || {};
  try {
    switch (mode) {
      // 4a：验证云函数本身能跑（不依赖 DeepSeek）
      case 'ping':
        return { ok: true, msg: 'AI 云函数已连通 ✔（没配 key 也能通）' };

      // 4a：验证 云函数 → DeepSeek 通路（需已配置 key）
      case 'test': {
        if (!API_KEY) {
          return { ok: false, error: '还没配置 DEEPSEEK_API_KEY 环境变量，配置后右键云函数重新部署再试' };
        }
        const reply = await callDeepSeek([
          { role: 'system', content: '你是 AI 经济顾问，帮学生管钱。回复要短、口语化。' },
          { role: 'user', content: event.prompt || '你好，打个招呼吧。' }
        ], { maxTokens: 200 });
        return { ok: true, reply };
      }

      // 4b：记账自动分类（描述 → 6 类）
      case 'classify': {
        if (!API_KEY) {
          return { ok: false, error: '还没配置 DEEPSEEK_API_KEY 环境变量' };
        }
        const desc = (event.desc || '').trim();
        if (!desc) return { ok: true, category: '其他' };
        const categories = ['餐饮', '交通', '购物', '娱乐', '学习', '其他'];
        const catReply = await callDeepSeek([
          { role: 'system', content: '你是记账分类助手。把用户的一句话描述归到 6 类之一，只回复类别名，不要任何多余文字。6 类：' + categories.join('、') },
          { role: 'user', content: desc }
        ], { temperature: 0, maxTokens: 50 });
        // 只接受列表内的类别，否则兜底"其他"
        const cat = catReply.trim().replace(/[。！？!·\s]/g, '');
        return { ok: true, category: categories.indexOf(cat) >= 0 ? cat : '其他' };
      }

      // 5a/5d：汇报与总结点评（today 今日汇报 / month 本月汇报 / insight 本月分布点评）
      case 'report': {
        if (!API_KEY) {
          return { ok: false, error: '还没配置 DEEPSEEK_API_KEY 环境变量' };
        }
        const scope = event.scope === 'insight' ? 'insight' : (event.scope === 'today' ? 'today' : 'month');
        const isToday = scope === 'today';
        const isInsight = scope === 'insight';
        const scopeName = isToday ? '今日' : '本月';

        // insight：不生成"汇报"，而是点评消费分布（花在哪、哪值/哪不值）
        const system = isInsight ? [
          '你是「零钱智能体」，一个面向学生的 AI 经济顾问。',
          '用户没有独立收入，生活费来自父母/亲戚。',
          '请对用户的【本月消费分布】做一次点评，分三小段：',
          '① 钱主要花在哪（按分类，金额和占比）',
          '② 从分布看出什么问题或亮点（哪类偏高/偏低、节奏快慢、哪些可能花得不值）',
          '③ 给 1~3 条具体可执行的建议',
          '要求：',
          '- 引用下方真实账本数据，不要空谈',
          '- 结合下方「最近聊过」理解消费背景，用户自己说过的细节优先，不要凭空揣测',
          '- 口语化、像朋友聊天，全文 300 字以内',
          '- 不做投资/理财建议，只做「参考 + 教育」',
          '',
          '===== 本月数据（供你参考）=====',
          event.context || '（暂无数据）'
        ].join('\n') : [
          '你是「零钱智能体」，一个面向学生的 AI 经济顾问。',
          '用户没有独立收入，生活费来自父母/亲戚。',
          '请生成一份【' + scopeName + '经济汇报】，分三小段：',
          isToday
            ? '① 今天花了多少、花在哪（按分类）'
            : '① 这个月到现在花了多少、花在哪（按分类）',
          '② 从数据里看到的问题或亮点（比如某类偏高、节奏太快、某笔看起来值不值）',
          '③ 给 1~3 条具体可执行的建议',
          '要求：',
          '- 引用下方真实账本数据，不要空谈',
          '- 结合下方「最近聊过」理解消费背景，用户自己说过的细节优先，不要凭空揣测',
          '- 口语化、像朋友聊天，全文 300 字以内',
          '- 不做投资/理财建议，只做「参考 + 教育」',
          '',
          '===== ' + scopeName + ' 数据（供你参考）=====',
          event.context || '（暂无数据）'
        ].join('\n');

        const report = await callDeepSeek([
          { role: 'system', content: system },
          { role: 'user', content: isInsight ? '请点评我的本月消费分布' : '请生成' + scopeName + '汇报' }
        ], { temperature: 0.6, maxTokens: 500 });
        return { ok: true, report };
      }

      // 4c：顾问对话（带实时账本摘要 + 会话历史，RAG）
      case 'chat': {
        if (!API_KEY) {
          return { ok: false, error: '还没配置 DEEPSEEK_API_KEY 环境变量' };
        }
        const question = (event.question || '').trim();
        if (!question) return { ok: false, error: '问题为空' };

        // 顾问手册（提示词）要点见 docs/tech.md §5
        const system = [
          '你是「零钱智能体」，一个面向学生的 AI 经济顾问。',
          '用户没有独立收入，生活费来自父母/亲戚。',
          '回答要求：',
          '- 先判断用户是什么话题，再决定怎么回：',
          '  ① 在分享开心/满足的事（看了电影很开心、吃到好吃的、买到喜欢的东西）→ 先真心接住、为 ta 高兴，最多自然带一句「这钱花得值」，不要反问、不要把话题扭回审视；',
          '  ② 在求助/犹豫（该不该买、钱不够了、超支了怎么办）→ 帮 ta 分清「需要 vs 想要」，权衡花费与满足感，给出明确倾向；',
          '  ③ 在查数据（花了多少、哪类最多）→ 引用下面账本数据回答，不空谈',
          '- 禁令：绝不用反问句引导用户自我反思（如「你问问自己会不会遗憾/后悔/值不值」），尤其用户分享开心事时——那很扫兴、像说教',
          '- 语气温和但直接，回答简短（一般 200 字以内），口语化，像朋友聊天',
          '- 不做投资/理财建议，只做「参考 + 教育」',
          '',
          '===== 当前预算与最近消费（供你参考）=====',
          event.context || '（暂无账本数据）'
        ].join('\n');

        // 会话历史（最多 10 条，数据最小化）
        const history = (event.history || []).map(m => ({ role: m.role, content: m.text }));

        const reply = await callDeepSeek([
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: question }
        ], { temperature: 0.7, maxTokens: 300 });
        return { ok: true, reply };
      }

      default:
        return { ok: false, error: '未知的 mode：' + mode };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
