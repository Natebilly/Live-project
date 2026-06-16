/* ============================================
   AI Product Intel Engine — Server
   Express proxy for Vertex AI (Gemini) +
   static file serving
   ============================================ */

const express = require('express');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const { mountMCP } = require('./mcp-server');

const app = express();
const PORT = 3000;
const PROJECT_ID = 'my-openclaw-project-22196';
const LOCATION = 'us-central1';
const MODEL_ID = 'gemini-1.5-flash-001';
const RESEARCH_MODEL_ID = 'gemini-1.5-flash-001';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// ---- Google Auth ----
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function getAccessToken() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

// ---- Vertex AI Gemini Endpoint ----
const VERTEX_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;

// ---- Analysis Prompt Builder ----
function buildAnalysisPrompt(productData) {
  const { name, description, category, targetAudience, monetization } = productData;

  return {
    contents: [{
      role: 'user',
      parts: [{
        text: `You are an expert product analyst and venture capital advisor. Analyze this product idea using deep, multi-step reasoning.

PRODUCT DETAILS:
- Name: ${name}
- Description: ${description}
- Category: ${category || 'Not specified'}
- Target Audience: ${targetAudience || 'Not specified'}
- Monetization: ${monetization || 'Not specified'}

Perform a thorough 6-step chain-of-thought analysis. For each step, provide your reasoning process (2-3 sentences explaining your thinking), then your conclusion.

Return a JSON object (no markdown, no code fences, pure JSON only) with this exact structure:
{
  "thinkingSteps": [
    {
      "step": 1,
      "title": "Market Demand Analysis",
      "reasoning": "Your detailed reasoning about market demand...",
      "conclusion": "One sentence summary of demand assessment"
    },
    {
      "step": 2,
      "title": "Revenue & Profitability Modeling",
      "reasoning": "Your detailed reasoning about revenue potential...",
      "conclusion": "One sentence summary"
    },
    {
      "step": 3,
      "title": "Competitive Landscape Assessment",
      "reasoning": "Your detailed reasoning about competition...",
      "conclusion": "One sentence summary"
    },
    {
      "step": 4,
      "title": "AI Feasibility & Technical Analysis",
      "reasoning": "Your detailed reasoning about AI implementation...",
      "conclusion": "One sentence summary"
    },
    {
      "step": 5,
      "title": "Cross-Dimensional Synthesis",
      "reasoning": "Your analysis of how the dimensions interact...",
      "conclusion": "One sentence summary of emergent patterns"
    },
    {
      "step": 6,
      "title": "Final Verdict & Recommendations",
      "reasoning": "Your final assessment and strategic advice...",
      "conclusion": "One sentence overall verdict"
    }
  ],
  "scores": {
    "demand": { "score": 0, "summary": "..." },
    "profitability": { "score": 0, "summary": "..." },
    "competition": { "score": 0, "summary": "..." },
    "aiEase": { "score": 0, "summary": "..." },
    "overall": { "score": 0, "confidence": 0 }
  },
  "insights": [
    { "type": "strength|weakness|opportunity|warning|tip", "title": "...", "text": "..." }
  ],
  "recommendation": {
    "level": "strong-go|go|conditional|rethink|stop",
    "text": "Actionable recommendation in 1-2 sentences",
    "icon": "🚀|✅|⚠️|🔄|🛑"
  },
  "recommendedModels": [
    { "model": "Model Name", "reason": "Why this model fits", "provider": "Provider" }
  ]
}

SCORING RULES:
- All scores are 0-100
- demand: How large and active is the market? Is there growing interest?
- profitability: Can this make money? What are the margins? Is the business model sound?
- competition: How crowded is the space? Can this product differentiate? (higher = less competition = better)
- aiEase: How well do current AI capabilities serve this product's needs? (higher = easier to build with AI)
- overall: Weighted average with your judgment applied
- confidence: 0-100, how confident are you in this assessment given the information provided

Be realistic and nuanced. Don't give inflated scores. Most products should score 40-70. Only truly exceptional ideas score 80+.
Provide at least 3 insights and at least 3 model recommendations.`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      topP: 0.95
    }
  };
}

// ---- API Endpoint ----
app.post('/api/analyze', async (req, res) => {
  try {
    const productData = req.body;
    if (!productData.name || !productData.description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    console.log(`[AI Analysis] Analyzing: "${productData.name}"`);

    const token = await getAccessToken();
    const prompt = buildAnalysisPrompt(productData);

    const response = await fetch(VERTEX_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prompt)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Vertex AI Error] ${response.status}: ${errText}`);
      return res.status(response.status).json({
        error: 'Vertex AI request failed',
        detail: errText,
        fallback: true
      });
    }

    const data = await response.json();

    // Extract the text content from Gemini's response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      console.error('[Vertex AI] No text content in response');
      return res.status(500).json({ error: 'Empty response from AI', fallback: true });
    }

    // Parse JSON from the response (handle potential markdown fences)
    let analysisResult;
    try {
      let jsonStr = textContent.trim();
      // Strip markdown code fences if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      analysisResult = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[Parse Error]', parseErr.message);
      console.error('[Raw Response]', textContent.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse AI response',
        raw: textContent.substring(0, 1000),
        fallback: true
      });
    }

    console.log(`[AI Analysis] Complete. Score: ${analysisResult.scores?.overall?.score}/100`);
    res.json({ success: true, analysis: analysisResult });

  } catch (err) {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: err.message, fallback: true });
  }
});

// ---- Research Models Endpoint ----
app.post('/api/research-models', async (req, res) => {
  try {
    const { existingModelNames } = req.body;
    console.log(`[AI Research] Searching for new models...`);

    const token = await getAccessToken();
    const researchUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${RESEARCH_MODEL_ID}:generateContent`;

    const prompt = {
      contents: [{
        role: 'user',
        parts: [{
          text: `You are an AI tools researcher. Search the live internet for recent, popular, or highly useful AI tools and models that are NOT in this list:
[${(existingModelNames || []).join(', ')}]

Find exactly 5 NEW tools/models. Ensure they are real, currently available AI tools.
Return the result strictly as a JSON array (no markdown code blocks, just the JSON).
The array should contain 5 objects with this exact structure:
[
  {
    "id": "lowercase-hyphenated-name",
    "name": "Official Tool Name",
    "provider": "Company/Creator Name",
    "description": "A 1-2 sentence compelling description of what it does.",
    "category": "Must be one of: Language Models, Image Generation, Video Generation, Audio/Voice, Code Generation, Automation, Search, Productivity, Multimodal, Data Analysis",
    "tags": ["tag1", "tag2", "tag3"],
    "pricing": "Must be one of: Free, Freemium, Paid, API-Based",
    "url": "https://official-website.com"
  }
]`
        }]
      }],
      tools: [{ googleSearchRetrieval: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        topP: 0.95
      }
    };

    const response = await fetch(researchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prompt)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Research Error] ${response.status}: ${errText}`);
      return res.status(response.status).json({ error: 'Research failed', detail: errText });
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      return res.status(500).json({ error: 'Empty response from AI during research' });
    }

    let newModels;
    try {
      let jsonStr = textContent.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      newModels = JSON.parse(jsonStr);
      if (!Array.isArray(newModels)) {
        throw new Error('AI did not return an array');
      }
    } catch (err) {
      console.error('[Research Parse Error]', err.message);
      return res.status(500).json({ error: 'Failed to parse researched models', raw: textContent });
    }

    console.log(`[AI Research] Found ${newModels.length} new models.`);
    res.json({ success: true, models: newModels });

  } catch (err) {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Health Check ----
app.get('/api/health', async (req, res) => {
  try {
    await getAccessToken();
    res.json({ status: 'ok', vertexAI: true, project: PROJECT_ID, model: MODEL_ID });
  } catch (err) {
    res.json({ status: 'ok', vertexAI: false, error: err.message });
  }
});

// ---- Mount MCP Server ----
mountMCP(app);

// ---- SPA Fallback ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Intel Engine Server running at http://localhost:${PORT}`);
  console.log(`🤖 Vertex AI: ${MODEL_ID} @ ${LOCATION}`);
  console.log(`📁 Project: ${PROJECT_ID}\n`);
});
