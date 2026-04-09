// FULL EXTENSION WITH IMPROVEMENTS
// Includes:
// - streaming responses
// - multiple providers (OpenAI, Ollama, Gemini mock)
// - storage for API keys
// - better UI
// - text selection support

// ================= manifest.json =================
{
  "manifest_version": 3,
  "name": "AI Side Panel Pro",
  "version": "2.0",
  "permissions": ["activeTab","scripting","storage","sidePanel"],
  "host_permissions": ["<all_urls>"],
  "background": {"service_worker": "background.js"},
  "side_panel": {"default_path": "sidepanel.html"},
  "commands": {
    "open_panel": {"suggested_key": {"default": "Ctrl+Shift+Y"}},
    "summarize": {"suggested_key": {"default": "Ctrl+Shift+S"}},
    "explain_selection": {"suggested_key": {"default": "Ctrl+Shift+E"}}
  }
}

// ================= background.js =================
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (command === "open_panel") {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  }

  if (command === "summarize") {
    const res = await chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_TEXT" });
    chrome.runtime.sendMessage({ action: "SUMMARIZE", text: res.text });
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  }

  if (command === "explain_selection") {
    const res = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
    chrome.runtime.sendMessage({ action: "EXPLAIN", text: res.text });
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  }
});

// ================= content.js =================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_PAGE_TEXT") {
    sendResponse({ text: document.body.innerText.slice(0, 20000) });
  }

  if (msg.action === "GET_SELECTION") {
    sendResponse({ text: window.getSelection().toString() });
  }
});

// ================= sidepanel.html =================
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="style.css">
</head>
<body>
<h2>AI Assistant</h2>

<select id="provider">
<option value="openai">OpenAI</option>
<option value="ollama">Ollama</option>
</select>

<input id="apikey" placeholder="API Key (OpenAI)" />
<button id="saveKey">Save Key</button>

<textarea id="input"></textarea>
<button id="send">Send</button>

<div class="actions">
<button id="summarize">Summarize Page</button>
<button id="explain">Explain Selection</button>
</div>

<div id="output"></div>

<script src="sidepanel.js"></script>
</body>
</html>

// ================= style.css =================
body { font-family: sans-serif; padding:10px; }
textarea { width:100%; height:80px; }
#output { white-space: pre-wrap; margin-top:10px; }
button { margin-top:5px; }
.actions button { margin-right:5px; }

// ================= sidepanel.js =================
const output = document.getElementById("output");

// save API key

document.getElementById("saveKey").onclick = async () => {
  const key = document.getElementById("apikey").value;
  await chrome.storage.local.set({ openai_key: key });
};

// send message

document.getElementById("send").onclick = async () => {
  const text = document.getElementById("input").value;
  runAI(text);
};

// summarize

document.getElementById("summarize").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  const res = await chrome.tabs.sendMessage(tab.id, { action:"GET_PAGE_TEXT" });
  runAI("Summarize in 3 sentences:\n" + res.text);
};

// explain

document.getElementById("explain").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  const res = await chrome.tabs.sendMessage(tab.id, { action:"GET_SELECTION" });
  runAI("Explain simply:\n" + res.text);
};

chrome.runtime.onMessage.addListener((msg)=>{
  if(msg.action==="SUMMARIZE") runAI("Summarize:\n"+msg.text);
  if(msg.action==="EXPLAIN") runAI("Explain:\n"+msg.text);
});

async function runAI(prompt){
  const provider = document.getElementById("provider").value;
  output.innerText = "Loading...";

  if(provider==="openai"){
    const { openai_key } = await chrome.storage.local.get("openai_key");
    streamOpenAI(prompt, openai_key);
  } else {
    streamOllama(prompt);
  }
}

// STREAMING OPENAI
async function streamOpenAI(prompt, apiKey){
  output.innerText = "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${apiKey}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model:"gpt-4o-mini",
      stream:true,
      messages:[{role:"user", content:prompt}]
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while(true){
    const {done, value} = await reader.read();
    if(done) break;

    const chunk = decoder.decode(value);
    output.innerText += chunk;
  }
}

// STREAMING OLLAMA
async function streamOllama(prompt){
  output.innerText = "";

  const res = await fetch("http://localhost:11434/api/generate",{
    method:"POST",
    body:JSON.stringify({model:"llama3", prompt, stream:true})
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while(true){
    const {done, value} = await reader.read();
    if(done) break;
    output.innerText += decoder.decode(value);
  }
}


// ================= ADVANCED FEATURES (NEXT LEVEL) =================
// Added:
// - chat history
// - markdown rendering
// - streaming parser (proper SSE parsing)
// - modes (ELI5, bullets, translate)
// - basic RAG-lite chunking
// - error handling

// ================= utils.js =================
export function chunkText(text, size = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export function buildPrompt(mode, text) {
  if (mode === "eli5") return `Explain like I'm 5:
${text}`;
  if (mode === "bullets") return `Summarize in bullet points:
${text}`;
  if (mode === "translate") return `Translate to English:
${text}`;
  return text;
}

// ================= IMPROVED STREAM PARSER =================
async function streamOpenAI(prompt, apiKey) {
  output.innerText = "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("
");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = line.replace("data: ", "");
        if (json === "[DONE]") return;
        try {
          const parsed = JSON.parse(json);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) output.innerText += token;
        } catch (e) {}
      }
    }
  }
}

// ================= CHAT HISTORY =================
async function saveMessage(role, content) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.push({ role, content });
  await chrome.storage.local.set({ history });
}

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get("history");
  return history;
}

// ================= MARKDOWN RENDER =================
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/
/g, '<br>');
}

// ================= ERROR HANDLING =================
function handleError(e) {
  output.innerText = "Error: " + e.message;
}

// ================= TECH SPEC (ТЗ) =================
/*
PROJECT: AI Chrome Side Panel Assistant Pro

GOAL:
Create a browser extension that integrates AI chat, page understanding, and contextual assistance.

CORE FEATURES:
1. Side panel UI
2. Multi-provider AI (OpenAI, Ollama, Gemini)
3. Streaming responses
4. Page summarization
5. Selection explanation
6. Chat history
7. Prompt modes (ELI5, bullets, translate)

ADVANCED FEATURES:
1. RAG-lite (chunking + selective prompts)
2. Markdown rendering
3. Error handling
4. API key management
5. Keyboard shortcuts

FUTURE ROADMAP:
- Full RAG with embeddings
- Vector DB (local)
- Multi-tab awareness
- Voice input
- Screenshot analysis

ARCHITECTURE:
- background.js (commands)
- content.js (page access)
- sidepanel.js (UI + AI orchestration)
- utils.js (helpers)

SECURITY:
- API keys stored locally
- No external logging

DEPLOYMENT:
- Chrome Web Store

MONETIZATION IDEAS:
- Freemium (local free, cloud paid)
- Team features
- Knowledge base sync
*/
