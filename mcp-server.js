/* ============================================
   Intel Engine — MCP Server Module
   JSON-RPC 2.0 over SSE transport
   Implements Model Context Protocol v1.0
   ============================================ */

const { v4: uuidv4 } = require('uuid');

// ---- Server State ----
const SERVER_INFO = {
  name: 'intel-engine',
  version: '2.0.0',
  protocolVersion: '2024-11-05'
};

const connections = new Map();
const connectionLog = [];
const startedAt = Date.now();

// ---- Scoring Engine (server-side mirror) ----
// Lightweight heuristic scorer for MCP tool calls
const ServerScoring = {
  clusters: {
    demandHigh: {
      'artificial intelligence': 9, 'ai': 8, 'machine learning': 8, 'automation': 7,
      'saas': 7, 'cloud': 6, 'data analytics': 7, 'cybersecurity': 8,
      'health': 6, 'healthcare': 7, 'fintech': 7, 'education': 6,
      'ecommerce': 6, 'marketplace': 6, 'productivity': 6, 'mobile app': 5,
      'no-code': 6, 'developer tools': 6, 'ai agent': 10, 'generative ai': 9,
      'llm': 7, 'voice ai': 7, 'personalization': 6
    },
    highMargin: {
      'software': 6, 'saas': 8, 'subscription': 7, 'platform': 6,
      'api': 6, 'course': 5, 'consulting': 5, 'premium': 4,
      'enterprise': 7, 'b2b': 6, 'license': 5
    }
  },

  analyze(productData) {
    const { name, description, category, targetAudience, monetization } = productData;
    const text = `${name} ${description} ${category || ''} ${targetAudience || ''} ${monetization || ''}`.toLowerCase();

    const demandScore = this.scoreFromCluster(text, this.clusters.demandHigh, 35, 85);
    const profitScore = this.scoreFromCluster(text, this.clusters.highMargin, 30, 80);
    const compScore = Math.max(20, Math.min(90, 65 + (Math.random() * 30 - 15)));
    const aiScore = text.includes('ai') || text.includes('machine learning') ? 75 + Math.random() * 15 : 45 + Math.random() * 25;
    const overall = Math.round(demandScore * 0.3 + profitScore * 0.25 + compScore * 0.25 + aiScore * 0.2);

    return {
      productName: name,
      analysisMode: 'heuristic',
      timestamp: new Date().toISOString(),
      scores: {
        demand: { score: Math.round(demandScore), summary: `Market demand analysis for ${name}`, factors: [] },
        profitability: { score: Math.round(profitScore), summary: `Revenue potential assessment`, factors: [] },
        competition: { score: Math.round(compScore), summary: `Competitive landscape evaluation`, factors: [] },
        aiEase: { score: Math.round(aiScore), summary: `AI implementation feasibility`, factors: [], recommendedModels: [] },
        overall: { score: overall, confidence: 65 + Math.round(Math.random() * 20), grade: overall >= 80 ? 'A' : overall >= 60 ? 'B' : overall >= 40 ? 'C' : 'D' }
      },
      insights: [
        { type: 'strength', title: 'Product Concept', text: `${name} addresses identifiable market needs.` },
        { type: 'opportunity', title: 'Growth Potential', text: `The ${category || 'technology'} sector shows strong growth trajectory.` },
        { type: 'tip', title: 'Next Steps', text: 'Consider validating with target users before full development.' }
      ],
      recommendation: {
        level: overall >= 70 ? 'go' : overall >= 50 ? 'conditional' : 'rethink',
        text: overall >= 70 ? 'Strong potential — proceed with development.' : overall >= 50 ? 'Promising but needs refinement.' : 'Consider pivoting the approach.',
        icon: overall >= 70 ? '🚀' : overall >= 50 ? '⚠️' : '🔄'
      }
    };
  },

  scoreFromCluster(text, cluster, min, max) {
    let hits = 0, weight = 0;
    for (const [kw, w] of Object.entries(cluster)) {
      if (text.includes(kw)) { hits++; weight += w; }
    }
    if (hits === 0) return min + Math.random() * 15;
    return Math.min(max, min + (weight / hits) * hits * 2.5 + Math.random() * 10);
  }
};

// ---- MCP Tool Definitions ----
const MCP_TOOLS = [
  {
    name: 'analyze_product',
    description: 'Run a full product idea analysis with heuristic scoring across demand, profitability, competition, and AI feasibility dimensions. Returns scores (0-100), insights, and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description — what it does, who it serves, what problem it solves' },
        category: { type: 'string', description: 'Product category (e.g., SaaS, Mobile App, AI/ML, Fintech)', enum: ['SaaS','Mobile App','E-commerce','AI/ML','Fintech','HealthTech','EdTech','Marketplace','Content/Media','Developer Tools','Hardware','Other'] },
        targetAudience: { type: 'string', description: 'Target audience (e.g., small business owners, developers)' },
        monetization: { type: 'string', description: 'Monetization model', enum: ['Subscription/SaaS','Freemium','One-time Purchase','Marketplace/Commission','Advertising','Usage-based','License','Open Source'] }
      },
      required: ['name', 'description']
    }
  },
  {
    name: 'get_analysis_history',
    description: 'Retrieve past product analyses. Returns an array of previous analysis results with scores and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results to return (default 10)' }
      }
    }
  },
  {
    name: 'search_ai_registry',
    description: 'Search the AI model/tool registry by name, provider, category, or capability. Returns matching models with descriptions, pricing, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (searches name, provider, description, tags)' },
        category: { type: 'string', description: 'Filter by category', enum: ['Language Models','Code Generation','Image Generation','Video Generation','Audio/Voice','Search','Automation','Multimodal','Productivity','Data Analysis'] },
        pricing: { type: 'string', description: 'Filter by pricing tier', enum: ['Free','Freemium','Paid','API-Based'] },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    }
  },
  {
    name: 'get_registry_stats',
    description: 'Get statistics about the AI model registry — total models, models by provider, by category, and pricing breakdown.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'generate_product_plan',
    description: 'Generate a step-by-step product creation plan for a given product idea. Includes phases, tasks, AI model suggestions, and prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        productName: { type: 'string', description: 'Name of the product' },
        productDescription: { type: 'string', description: 'Description of the product' },
        category: { type: 'string', description: 'Product category' }
      },
      required: ['productName', 'productDescription']
    }
  },
  {
    name: 'get_freelance_opportunities',
    description: 'Get a list of beginner-friendly freelance job categories with sites, pay ranges, and difficulty levels.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by job category (e.g., Transcription, Data Entry, Writing)' }
      }
    }
  }
];

// ---- MCP Resource Definitions ----
const MCP_RESOURCES = [
  {
    uri: 'intel://registry/models',
    name: 'AI Model Registry',
    description: 'Complete list of AI models and tools in the Intel Engine registry',
    mimeType: 'application/json'
  },
  {
    uri: 'intel://analyses/recent',
    name: 'Recent Analyses',
    description: 'Most recent product analyses with scores and insights',
    mimeType: 'application/json'
  }
];

// ---- Data Store (server-side, loaded from file or seeded) ----
let registryData = [];
let analysisHistory = [];
let freelanceData = [
  { name: 'Transcription', icon: '🎧', avgPay: '$15-30/hr', difficulty: 'Beginner', description: 'Convert audio/video to text.', sites: [{ name: 'Rev', url: 'https://www.rev.com', note: 'Popular platform', pay: '$0.30-1.10/min' }, { name: 'TranscribeMe', url: 'https://www.transcribeme.com', note: 'Short audio clips', pay: '$15-22/hr' }] },
  { name: 'Data Entry', icon: '📊', avgPay: '$10-20/hr', difficulty: 'Beginner', description: 'Input and organize data into systems.', sites: [{ name: 'Clickworker', url: 'https://www.clickworker.com', note: 'Micro-tasks', pay: '$9-15/hr' }, { name: 'Amazon MTurk', url: 'https://www.mturk.com', note: 'HITs marketplace', pay: 'Varies' }] },
  { name: 'Content Writing', icon: '✍️', avgPay: '$20-60/hr', difficulty: 'Intermediate', description: 'Write articles, blog posts, and copy.', sites: [{ name: 'Contently', url: 'https://contently.com', note: 'Premium brands', pay: '$0.20-1/word' }, { name: 'Textbroker', url: 'https://www.textbroker.com', note: 'Star rating system', pay: '$0.01-0.05/word' }] },
  { name: 'Video Review', icon: '🎬', avgPay: '$5-15/task', difficulty: 'Beginner', description: 'Watch and annotate video content.', sites: [{ name: 'Appen', url: 'https://appen.com', note: 'AI training data', pay: '$5-20/hr' }] },
  { name: 'Microtasks', icon: '⚡', avgPay: '$5-15/hr', difficulty: 'Beginner', description: 'Complete small online tasks.', sites: [{ name: 'Toloka', url: 'https://toloka.ai', note: 'AI data labeling', pay: '$2-10/hr' }, { name: 'Spare5', url: 'https://app.spare5.com', note: 'Image tagging', pay: 'Per task' }] }
];

// ---- Tool Handlers ----
function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'analyze_product':
      return ServerScoring.analyze({
        name: args.name || 'Unnamed Product',
        description: args.description || '',
        category: args.category || '',
        targetAudience: args.targetAudience || '',
        monetization: args.monetization || ''
      });

    case 'get_analysis_history':
      return analysisHistory.slice(0, args.limit || 10);

    case 'search_ai_registry': {
      let results = [...registryData];
      if (args.query) {
        const q = args.query.toLowerCase();
        results = results.filter(m =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.provider || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (m.tags || []).some(t => t.toLowerCase().includes(q)) ||
          (m.capabilities || []).some(c => c.toLowerCase().includes(q))
        );
      }
      if (args.category) {
        results = results.filter(m => (m.category || '').toLowerCase() === args.category.toLowerCase());
      }
      if (args.pricing) {
        results = results.filter(m => {
          const p = (m.pricing || m.type || '').toLowerCase();
          return p.includes(args.pricing.toLowerCase());
        });
      }
      return results.slice(0, args.limit || 20).map(m => ({
        name: m.name, provider: m.provider, description: m.description,
        category: m.category, pricing: m.pricing || m.type,
        url: m.url, tags: m.tags || m.capabilities || []
      }));
    }

    case 'get_registry_stats': {
      const providers = {};
      const categories = {};
      registryData.forEach(m => {
        providers[m.provider] = (providers[m.provider] || 0) + 1;
        const cat = m.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      return {
        totalModels: registryData.length,
        byProvider: providers,
        byCategory: categories,
        lastUpdated: new Date().toISOString()
      };
    }

    case 'generate_product_plan': {
      const phases = [
        { phase: 'Research & Validation', duration: '1-2 weeks', tasks: ['Market research', 'Competitor analysis', 'User interviews', 'Define MVP scope'] },
        { phase: 'Design & Architecture', duration: '1-2 weeks', tasks: ['UI/UX wireframes', 'System architecture', 'Database schema', 'API design'] },
        { phase: 'Core Development', duration: '4-8 weeks', tasks: ['Frontend development', 'Backend API', 'AI/ML integration', 'Authentication & security'] },
        { phase: 'Testing & Launch', duration: '2-3 weeks', tasks: ['Unit & integration tests', 'Beta testing', 'Performance optimization', 'Launch marketing'] },
        { phase: 'Growth & Iteration', duration: 'Ongoing', tasks: ['User feedback collection', 'Feature iteration', 'Scaling infrastructure', 'Analytics & metrics'] }
      ];
      return {
        productName: args.productName,
        generatedAt: new Date().toISOString(),
        totalPhases: phases.length,
        estimatedTimeline: '10-16 weeks',
        phases
      };
    }

    case 'get_freelance_opportunities': {
      let cats = [...freelanceData];
      if (args.category) {
        const q = args.category.toLowerCase();
        cats = cats.filter(c => c.name.toLowerCase().includes(q));
      }
      return cats;
    }

    default:
      throw { code: -32601, message: `Unknown tool: ${toolName}` };
  }
}

// ---- Resource Handlers ----
function handleResourceRead(uri) {
  switch (uri) {
    case 'intel://registry/models':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(registryData.slice(0, 50), null, 2)
      };
    case 'intel://analyses/recent':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(analysisHistory.slice(0, 20), null, 2)
      };
    default:
      throw { code: -32002, message: `Resource not found: ${uri}` };
  }
}

// ---- JSON-RPC 2.0 Message Handler ----
function handleJsonRpc(message, connectionId) {
  const { id, method, params } = message;

  // Log
  addLog('request', connectionId, `${method}${params?.name ? ` → ${params.name}` : ''}`);

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false }
          },
          serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version
          }
        }
      };

    case 'notifications/initialized':
      addLog('info', connectionId, 'Client initialized successfully');
      return null; // notifications don't get responses

    case 'tools/list':
      return {
        jsonrpc: '2.0', id,
        result: { tools: MCP_TOOLS }
      };

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = handleToolCall(toolName, toolArgs);
        addLog('success', connectionId, `Tool ${toolName} executed`);
        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: false
          }
        };
      } catch (err) {
        addLog('error', connectionId, `Tool ${toolName} failed: ${err.message || err}`);
        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: `Error: ${err.message || JSON.stringify(err)}` }],
            isError: true
          }
        };
      }
    }

    case 'resources/list':
      return {
        jsonrpc: '2.0', id,
        result: { resources: MCP_RESOURCES }
      };

    case 'resources/read': {
      const uri = params?.uri;
      try {
        const content = handleResourceRead(uri);
        return {
          jsonrpc: '2.0', id,
          result: { contents: [content] }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0', id,
          error: { code: err.code || -32603, message: err.message }
        };
      }
    }

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

// ---- Connection Log ----
function addLog(type, connectionId, message) {
  const entry = {
    id: uuidv4(),
    type,
    connectionId: connectionId?.substring(0, 8) || 'system',
    message,
    timestamp: new Date().toISOString()
  };
  connectionLog.unshift(entry);
  if (connectionLog.length > 200) connectionLog.length = 200;
}

// ---- Mount MCP Routes on Express ----
function mountMCP(app) {

  // SSE endpoint — client connects here
  app.get('/mcp/sse', (req, res) => {
    const connectionId = uuidv4();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send the endpoint URI for posting messages
    const messagesUrl = `/mcp/messages?sessionId=${connectionId}`;
    res.write(`event: endpoint\ndata: ${messagesUrl}\n\n`);

    connections.set(connectionId, {
      id: connectionId,
      res,
      connectedAt: new Date().toISOString(),
      lastActivity: Date.now(),
      clientInfo: req.headers['user-agent'] || 'Unknown'
    });

    addLog('connect', connectionId, `Client connected from ${req.ip || 'localhost'}`);
    console.log(`[MCP] Client connected: ${connectionId.substring(0, 8)}`);

    req.on('close', () => {
      connections.delete(connectionId);
      addLog('disconnect', connectionId, 'Client disconnected');
      console.log(`[MCP] Client disconnected: ${connectionId.substring(0, 8)}`);
    });

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch { clearInterval(keepAlive); }
    }, 30000);

    req.on('close', () => clearInterval(keepAlive));
  });

  // Messages endpoint — client posts JSON-RPC here
  app.post('/mcp/messages', (req, res) => {
    const sessionId = req.query.sessionId;
    const conn = connections.get(sessionId);

    if (!conn) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or expired session' }
      });
    }

    conn.lastActivity = Date.now();
    const message = req.body;

    if (!message || !message.jsonrpc) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: invalid JSON-RPC' }
      });
    }

    const response = handleJsonRpc(message, sessionId);

    // Notifications return null (no response needed)
    if (response === null) {
      res.status(202).end();
      return;
    }

    // Send response via SSE
    try {
      conn.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    } catch (err) {
      console.error(`[MCP] Failed to send SSE response: ${err.message}`);
    }

    // Also send as HTTP response for compatibility
    res.json(response);
  });

  // ---- Management API ----

  // Server status
  app.get('/api/mcp/status', (req, res) => {
    const conns = [];
    connections.forEach((c, id) => {
      conns.push({
        id: id.substring(0, 8),
        connectedAt: c.connectedAt,
        lastActivity: new Date(c.lastActivity).toISOString(),
        clientInfo: c.clientInfo
      });
    });

    res.json({
      running: true,
      serverInfo: SERVER_INFO,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      activeConnections: connections.size,
      connections: conns,
      totalToolCalls: connectionLog.filter(l => l.type === 'success').length,
      tools: MCP_TOOLS.map(t => t.name),
      resources: MCP_RESOURCES.map(r => r.uri),
      sseEndpoint: '/mcp/sse',
      messagesEndpoint: '/mcp/messages'
    });
  });

  // Connection log
  app.get('/api/mcp/log', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ log: connectionLog.slice(0, limit) });
  });

  // Client config generator
  app.get('/api/mcp/config/:client', (req, res) => {
    const client = req.params.client;
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `http://${host}`;

    const configs = {
      'claude-desktop': {
        format: 'json',
        filename: 'claude_desktop_config.json',
        config: {
          mcpServers: {
            'intel-engine': {
              url: `${baseUrl}/mcp/sse`,
              transport: 'sse'
            }
          }
        },
        instructions: `Add this to your Claude Desktop config file:\n• macOS: ~/Library/Application Support/Claude/claude_desktop_config.json\n• Windows: %APPDATA%\\Claude\\claude_desktop_config.json`
      },
      'cursor': {
        format: 'json',
        filename: '.cursor/mcp.json',
        config: {
          mcpServers: {
            'intel-engine': {
              url: `${baseUrl}/mcp/sse`,
              transport: 'sse'
            }
          }
        },
        instructions: 'Add this to your project\'s .cursor/mcp.json file, or to your global Cursor settings under MCP Servers.'
      },
      'windsurf': {
        format: 'json',
        filename: 'mcp_config.json',
        config: {
          mcpServers: {
            'intel-engine': {
              serverUrl: `${baseUrl}/mcp/sse`,
              transport: 'sse'
            }
          }
        },
        instructions: 'Add this to Windsurf\'s MCP configuration under Settings → MCP Servers.'
      },
      'chatgpt': {
        format: 'json',
        filename: 'mcp_actions.json',
        config: {
          name: 'Intel Engine',
          description: 'AI Product Analysis & Intel Engine — analyze product ideas, search AI models, generate plans',
          url: `${baseUrl}/mcp/sse`,
          transport: 'sse',
          tools: MCP_TOOLS.map(t => t.name)
        },
        instructions: 'Use this configuration in ChatGPT\'s MCP Actions panel (Settings → Actions → Add MCP Server).'
      },
      'generic': {
        format: 'json',
        filename: 'mcp_config.json',
        config: {
          server: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version,
            sseUrl: `${baseUrl}/mcp/sse`,
            messagesUrl: `${baseUrl}/mcp/messages`,
            transport: 'sse'
          },
          availableTools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
          availableResources: MCP_RESOURCES.map(r => ({ uri: r.uri, name: r.name }))
        },
        instructions: 'Point your MCP client to the SSE URL above. Messages should be POSTed to the messages URL with the sessionId query parameter.'
      }
    };

    const cfg = configs[client];
    if (!cfg) {
      return res.status(404).json({ error: `Unknown client: ${client}. Valid: ${Object.keys(configs).join(', ')}` });
    }

    res.json(cfg);
  });

  // Seed data endpoint (called from frontend on startup)
  app.post('/api/mcp/seed', (req, res) => {
    const { registry, analyses } = req.body;
    if (registry) registryData = registry;
    if (analyses) analysisHistory = analyses;
    console.log(`[MCP] Data seeded: ${registryData.length} models, ${analysisHistory.length} analyses`);
    res.json({ success: true, models: registryData.length, analyses: analysisHistory.length });
  });

  addLog('info', null, 'MCP Server initialized');
  console.log(`🔌 MCP Server mounted — SSE: /mcp/sse | Messages: /mcp/messages`);
}

module.exports = { mountMCP };
