// ═══════════════════════════════════════════════════
// 家庭财务规划师 — 后端API服务器
// 用法：修改 .env 文件中的API地址和Key，然后 npm start
// ═══════════════════════════════════════════════════

import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";

// ── 读取 .env 配置 ──
const envPath = new URL("./.env", import.meta.url);
const envFile = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
const env = { ...process.env };
envFile.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const [key, ...vals] = trimmed.split("=");
  env[key.trim()] = vals.join("=").trim();
});

const LLM_API_URL = env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = env.LLM_API_KEY || "";
const LLM_MODEL = env.LLM_MODEL || "gpt-4o";
const PORT = parseInt(env.PORT) || 3001;
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
const RATE_LIMIT_PER_HOUR = Math.max(1, parseInt(env.RATE_LIMIT_PER_HOUR || "20"));

// ── 判断API类型 ──
const isAnthropic = LLM_API_URL.includes("anthropic.com");
const isOllama = LLM_API_URL.includes("localhost:11434") || LLM_API_URL.includes("127.0.0.1:11434");

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin(origin, cb){ if(!origin || ALLOWED_ORIGINS.length===0 || ALLOWED_ORIGINS.includes(origin)) return cb(null,true); return cb(new Error("Origin not allowed")); } }));
app.use(express.json({ limit: "64kb" }));

const buckets = new Map();
app.use("/api/analyze", (req,res,next)=>{
  const now=Date.now(), key=req.ip || "unknown";
  const current=buckets.get(key);
  if(!current || current.resetAt<now){ buckets.set(key,{count:1,resetAt:now+3600000}); return next(); }
  if(current.count>=RATE_LIMIT_PER_HOUR) return res.status(429).json({error:"请求过于频繁，请稍后再试"});
  current.count++; next();
});

// ── 系统提示词 ──
const SYSTEM_PROMPT = `你是一位资深的中国家庭财务规划师，拥有CFP（注册金融规划师）资质。
用户已经通过我们的工具完成了财务数据录入和规则引擎计算，现在需要你根据计算结果给出个性化的专业解读。

请用以下结构输出分析报告：

## 总体评价
用2-3句话概括这个家庭的财务健康状况，像一位老朋友给出中肯评价。

## 最需要关注的问题
列出2-3个最紧迫的财务问题，每个问题给出具体可执行的解决方案，包含具体数字和时间节点。

## 做得好的地方
肯定1-2个做得好的方面，增强用户信心。

## 未来3年行动计划
给出按季度的具体行动建议，例如"第1季度：先把信用卡欠款还清，每月多还X元"。

## 一句话总结
用一句有力的话收尾。

注意事项：
- 所有建议必须基于用户的实际数据，引用具体数字
- 考虑中国国情：社保政策、房贷特点、教育支出压力、养老问题
- 语气专业但亲切，不要用套话
- 不要推荐具体金融产品或品牌
- 控制在800字以内`;

// ── 构造LLM请求 ──
function buildLLMRequest(payload) {
  const userMessage = `以下是用户的家庭财务数据和计算结果，请给出个性化分析：

【用户画像】
- 年龄：${payload.userProfile.age}岁，性别：${payload.userProfile.gender === "male" ? "男" : "女"}
- 城市等级：${payload.userProfile.city}，职业：${payload.userProfile.job}
- 家庭人口：${payload.userProfile.familySize}人，婚姻：${payload.userProfile.maritalStatus}

【房贷压力测试】
- 房贷余额：${payload.mortgage?.balance ?? "未提供"}元
- 当前月供：${payload.mortgage?.monthlyPayment ?? "未提供"}元
- 剩余年限：${payload.mortgage?.yearsLeft ?? "未提供"}年
- 收入下降30%后流动性可覆盖：${payload.mortgage?.stressRunway ?? "未提供"}个月
- 30年情景月供：${payload.mortgage?.payment30 ?? "未提供"}元
- 40年情景月供：${payload.mortgage?.payment40 ?? "未提供"}元

【核心指标】
- 家庭月收入（税前）：${payload.metrics.monthlyGross}元
- 家庭月收入（税后）：${payload.metrics.monthlyNet}元
- 月结余：${payload.metrics.monthlySurplus}元，结余率：${payload.metrics.savingsRate}
- 总资产：${payload.metrics.totalAssets}元
- 总负债：${payload.metrics.totalDebt}元
- 净资产：${payload.metrics.netWorth}元
- 负债率：${payload.metrics.debtRatio}
- 月供收入比：${payload.metrics.mortgageRatio}
- 紧急储备金可覆盖：${payload.metrics.emergencyMonths}个月
- 综合健康评分：${payload.metrics.overallScore}/100

【财务健康雷达】
${payload.radar.map((r) => `- ${r.label}：${r.score}/100`).join("\n")}

【风险预警】
${payload.risks.map((r) => `- [${r.level}] ${r.title}：${r.desc}`).join("\n")}

【养老分析】
- 距退休：${payload.pension.yearsToRetire}年
- 预估月养老金：${payload.pension.monthlyPension}元
- 养老缺口（扣除储蓄后）：${payload.pension.gap}元

【子女教育】
${payload.children.map((c, i) => `- 孩子${i + 1}：${c.age}岁，${c.plan}路线`).join("\n")}`;

  // Anthropic Claude API 格式
  if (isAnthropic) {
    return {
      url: LLM_API_URL,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": LLM_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: LLM_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      parseResponse: (json) => json.content?.[0]?.text || "",
    };
  }

  // OpenAI兼容格式（OpenAI、DeepSeek、Ollama、Moonshot、通义千问等）
  return {
    url: LLM_API_URL,
    headers: {
      "Content-Type": "application/json",
      ...(LLM_API_KEY && !isOllama ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
    },
    body: {
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    },
    parseResponse: (json) => json.choices?.[0]?.message?.content || "",
  };
}

// ── API 路由 ──
app.post("/api/analyze", async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.userProfile || !payload.metrics) {
      return res.status(400).json({ error: "缺少必要的财务数据" });
    }

    const llm = buildLLMRequest(payload);

    console.log(`\n→ 调用 LLM: ${llm.url}`);
    console.log(`  模型: ${LLM_MODEL}`);

    const response = await fetch(llm.url, {
      method: "POST",
      headers: llm.headers,
      body: JSON.stringify(llm.body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`✗ LLM返回错误 ${response.status}:`, errText);
      return res.status(502).json({ error: `LLM API错误: ${response.status}`, detail: errText });
    }

    const json = await response.json();
    const analysis = llm.parseResponse(json);

    if (!analysis) {
      console.error("✗ 无法解析LLM响应:", JSON.stringify(json).slice(0, 200));
      return res.status(502).json({ error: "无法解析AI响应" });
    }

    console.log(`✓ AI分析完成 (${analysis.length}字)`);
    res.json({ analysis });
  } catch (err) {
    console.error("✗ 服务器错误:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 健康检查 ──
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    llmUrl: LLM_API_URL,
    model: LLM_MODEL,
    hasKey: !!LLM_API_KEY,
  });
});

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════
  家庭财务规划师 — AI后端服务器
═══════════════════════════════════════════════════
  地址:   http://localhost:${PORT}
  LLM:    ${LLM_API_URL}
  模型:   ${LLM_MODEL}
  API Key: ${LLM_API_KEY ? "已配置 ✓" : "未配置 ✗"}
═══════════════════════════════════════════════════
  `);
});
