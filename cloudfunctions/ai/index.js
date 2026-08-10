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
      timeout: 30000 // 30 秒，DeepSeek 慢时也不至于卡死
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
          '- 语气温和但直接，帮用户分清「需要 vs 想要」',
          '- 尽量引用下面提供的真实账本数据说话，不要空谈',
          '- 回答简短（一般 200 字以内），口语化，像朋友给建议',
          '- 不做投资/理财建议，只做「参考 + 教育」',
          '- 如果用户问「该不该买」，帮 ta 权衡花费与满足感，并给出明确倾向',
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
        ], { temperature: 0.7, maxTokens: 500 });
        return { ok: true, reply };
      }

      default:
        return { ok: false, error: '未知的 mode：' + mode };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
