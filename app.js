const state = {
  halted: false,
  stream: null,
  workflow: [],
  actionQueue: [],
  loopActive: false,
  loopTimer: null,
  integrations: {
    emailFetchUrl: "",
    emailSendUrl: "",
    waFetchUrl: "",
    waSendUrl: ""
  }
};

const $ = (id) => document.getElementById(id);
const logEl = $("log");

function log(message) {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent += `[${stamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function guard() {
  if (state.halted) {
    log("System halted. Reload page to resume.");
    return true;
  }
  return false;
}

function saveIntegrations() {
  if (guard()) return;
  state.integrations = {
    emailFetchUrl: $("emailFetchUrl").value.trim(),
    emailSendUrl: $("emailSendUrl").value.trim(),
    waFetchUrl: $("waFetchUrl").value.trim(),
    waSendUrl: $("waSendUrl").value.trim()
  };
  localStorage.setItem("eryon.integrations", JSON.stringify(state.integrations));
  $("integrationStatus").textContent = "Integration config saved.";
  log("Saved integration endpoints.");
}

function loadIntegrations() {
  const saved = localStorage.getItem("eryon.integrations");
  if (!saved) return;
  try {
    const config = JSON.parse(saved);
    Object.assign(state.integrations, config);
    $("emailFetchUrl").value = config.emailFetchUrl || "";
    $("emailSendUrl").value = config.emailSendUrl || "";
    $("waFetchUrl").value = config.waFetchUrl || "";
    $("waSendUrl").value = config.waSendUrl || "";
    $("integrationStatus").textContent = "Loaded saved integration config.";
  } catch {
    log("Failed to parse saved integrations.");
  }
}

function parseTasks(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /\b(task|todo|homework|assignment|due|please|submit|buy|order|reply)\b/i.test(line));
}

function queueAction(type, payload) {
  state.actionQueue.push({ type, payload, status: "pending" });
  renderActionQueue();
}

function renderActionQueue() {
  const list = $("actionQueue");
  list.innerHTML = "";
  state.actionQueue.forEach((item, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. [${item.status}] ${item.type} - ${JSON.stringify(item.payload)}`;
    list.appendChild(li);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchMessages() {
  if (guard()) return;
  const { emailFetchUrl, waFetchUrl } = state.integrations;
  try {
    if (emailFetchUrl) {
      const data = await fetchJson(emailFetchUrl);
      $("emailInbox").value = Array.isArray(data) ? data.join("\n") : JSON.stringify(data, null, 2);
      log("Fetched email messages from integration.");
    }
    if (waFetchUrl) {
      const data = await fetchJson(waFetchUrl);
      $("whatsAppInbox").value = Array.isArray(data) ? data.join("\n") : JSON.stringify(data, null, 2);
      log("Fetched WhatsApp messages from integration.");
    }
  } catch (err) {
    log(`Message fetch failed: ${err.message}`);
  }
}

function findTasks() {
  if (guard()) return;
  const source = `${$("emailInbox").value}\n${$("whatsAppInbox").value}`;
  const tasks = parseTasks(source);
  const list = $("taskList");
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = "<li>No actionable tasks found.</li>";
  } else {
    tasks.forEach((task) => {
      const li = document.createElement("li");
      li.textContent = task;
      list.appendChild(li);
    });
  }
  log(`Extracted ${tasks.length} task(s) from inbox.`);
  return tasks;
}

function draftReplies() {
  if (guard()) return;
  const email = $("emailInbox").value.trim();
  const wa = $("whatsAppInbox").value.trim();
  const drafts = [];
  if (email) drafts.push("Email: Thanks for your message. I have captured this task and will update you after completion.");
  if (wa) drafts.push("WhatsApp: Got it ✅ I’ve added this to my queue and will send progress updates.");
  $("homeworkOutput").value = drafts.join("\n\n") || "No messages available to draft from.";
  log("Prepared reply drafts.");
  return drafts;
}

async function sendReply(channel, message) {
  const url = channel === "email" ? state.integrations.emailSendUrl : state.integrations.waSendUrl;
  if (!url) {
    log(`No ${channel} send URL configured. Skipped send.`);
    return;
  }
  await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, source: "eryon" })
  });
  log(`Sent ${channel} reply through configured integration.`);
}

function autoplanFromInbox() {
  if (guard()) return;
  const tasks = findTasks();
  tasks.forEach((task) => {
    if (/homework|assignment/i.test(task)) {
      queueAction("solve_homework", { prompt: task });
    } else if (/buy|order|shopping/i.test(task)) {
      queueAction("shop_search", { query: task });
    } else if (/reply|email/i.test(task)) {
      queueAction("draft_and_send_email", { context: task });
    } else if (/whatsapp/i.test(task)) {
      queueAction("draft_and_send_whatsapp", { context: task });
    } else {
      queueAction("open_site", { url: "https://www.google.com/search?q=" + encodeURIComponent(task) });
    }
  });
  log("Autoplan generated actions from inbox tasks.");
}

function draftHomeworkAnswer(prompt) {
  if (!prompt.trim()) return "";
  return `Answer Draft\n\nPrompt: ${prompt}\n\n- Understand the question intent\n- Break it into parts\n- Solve each part with concise reasoning\n- Provide final clean answer\n\nTip: Verify facts before submission.`;
}

async function executeAction(item) {
  if (guard()) return;
  item.status = "running";
  renderActionQueue();

  try {
    switch (item.type) {
      case "open_site":
        window.open(item.payload.url, "_blank");
        break;
      case "shop_search":
        window.open(`https://www.google.com/search?q=${encodeURIComponent(item.payload.query)}+buy+online`, "_blank");
        break;
      case "solve_homework": {
        const answer = draftHomeworkAnswer(item.payload.prompt);
        $("homeworkOutput").value = answer;
        break;
      }
      case "draft_and_send_email": {
        const msg = `Automated reply: I received your request (${item.payload.context}) and started working on it.`;
        await sendReply("email", msg);
        break;
      }
      case "draft_and_send_whatsapp": {
        const msg = `Automated WhatsApp reply: request received (${item.payload.context}). I’ll share progress soon.`;
        await sendReply("wa", msg);
        break;
      }
      default:
        log(`Unknown action type: ${item.type}`);
    }

    item.status = "done";
    log(`Action completed: ${item.type}`);
  } catch (err) {
    item.status = "failed";
    log(`Action failed (${item.type}): ${err.message}`);
  }

  renderActionQueue();
}

async function runNextAction() {
  if (guard()) return;
  const next = state.actionQueue.find((item) => item.status === "pending");
  if (!next) return;
  await executeAction(next);
}

function startAgentLoop() {
  if (guard()) return;
  if (state.loopActive) return;
  state.loopActive = true;
  log("Agent loop started.");
  state.loopTimer = setInterval(async () => {
    if (state.halted) return;
    await runNextAction();
  }, 1200);
}

function stopAgentLoop() {
  state.loopActive = false;
  clearInterval(state.loopTimer);
  state.loopTimer = null;
  log("Agent loop stopped.");
}

async function startScreen() {
  if (guard()) return;
  try {
    state.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    $("screenVideo").srcObject = state.stream;
    log("Screen sharing started.");
  } catch (err) {
    log(`Screen sharing error: ${err.message}`);
  }
}

function stopScreen() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  $("screenVideo").srcObject = null;
  log("Screen sharing stopped.");
}

function analyzeScreen() {
  if (guard()) return;
  $("screenAnalysis").textContent = state.stream
    ? "Live visual stream active. You can issue guided commands based on visible UI context."
    : "No screen feed active.";
  log("Screen analysis updated.");
}

function queueWorkflow() {
  if (guard()) return;
  const steps = $("workflowInput").value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  state.workflow = steps;
  const list = $("workflowList");
  list.innerHTML = "";
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    list.appendChild(li);
  });
  log(`Queued workflow with ${steps.length} step(s).`);
}

async function runWorkflow() {
  if (guard()) return;
  const items = Array.from($('workflowList').querySelectorAll('li'));
  for (const item of items) {
    if (state.halted) break;
    item.classList.add('running');
    queueAction('open_site', { url: `https://www.google.com/search?q=${encodeURIComponent(item.textContent)}` });
    await new Promise((r) => setTimeout(r, 250));
    item.classList.remove('running');
    item.classList.add('done');
  }
  log('Workflow converted into executable actions.');
}

function openSite() {
  if (guard()) return;
  const raw = $("siteUrl").value.trim();
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  queueAction("open_site", { url });
  log(`Queued open-site action: ${url}`);
}

function playYouTube() {
  if (guard()) return;
  const query = encodeURIComponent($("textPrompt").value || "music");
  queueAction("open_site", { url: `https://www.youtube.com/results?search_query=${query}` });
  log("Queued YouTube action.");
}

function shopSearch() {
  if (guard()) return;
  const query = $("textPrompt").value || "best deals";
  queueAction("shop_search", { query });
  log("Queued shopping action.");
}

function solveHomework() {
  if (guard()) return;
  const prompt = $("homeworkInput").value.trim();
  if (!prompt) return;
  queueAction("solve_homework", { prompt });
  log("Queued homework solve action.");
}

function saveDoc() {
  if (guard()) return;
  const name = ($("docName").value || "eryon-document").replace(/[^a-z0-9-_]/gi, "_");
  const content = $("docContent").value || $("homeworkOutput").value || "";
  const htmlDoc = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body><pre>${content.replace(/</g, "&lt;")}</pre></body></html>`;
  const blob = new Blob([htmlDoc], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
  log(`Saved .doc file: ${name}.doc`);
}

function runPrompt() {
  if (guard()) return;
  const prompt = $("textPrompt").value.trim();
  if (!prompt) return;
  log(`Prompt received: ${prompt}`);

  if (/autoplan/i.test(prompt)) return autoplanFromInbox();
  if (/fetch messages?/i.test(prompt)) return fetchMessages();
  if (/youtube/i.test(prompt)) return playYouTube();
  if (/shop|buy|order/i.test(prompt)) return shopSearch();

  const url = prompt.match(/https?:\/\/\S+/i)?.[0];
  if (url) {
    queueAction("open_site", { url });
    log(`Queued URL from prompt: ${url}`);
  } else {
    queueAction("open_site", { url: `https://www.google.com/search?q=${encodeURIComponent(prompt)}` });
    log("Prompt converted to web search action.");
  }
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("voiceStatus").textContent = "Voice recognition unsupported by this browser.";
    return null;
  }

  const rec = new Recognition();
  rec.lang = "en-US";
  rec.onstart = () => ($("voiceStatus").textContent = "Listening...");
  rec.onend = () => ($("voiceStatus").textContent = "Voice input idle.");
  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    $("textPrompt").value = transcript;
    log(`Voice prompt: ${transcript}`);
    runPrompt();
  };
  rec.onerror = (e) => log(`Voice error: ${e.error}`);
  return rec;
}

function killAll() {
  state.halted = true;
  stopAgentLoop();
  stopScreen();
  state.actionQueue.forEach((item) => {
    if (item.status === "pending" || item.status === "running") item.status = "cancelled";
  });
  renderActionQueue();
  $("voiceStatus").textContent = "Emergency stop engaged.";
  log("EMERGENCY KILL SWITCH ACTIVATED. Queue cancelled and automations halted.");
}

function clearQueue() {
  if (guard()) return;
  state.actionQueue = [];
  renderActionQueue();
  log("Cleared action queue.");
}

const recognition = setupVoice();
loadIntegrations();

$("saveIntegrations").onclick = saveIntegrations;
$("fetchMessages").onclick = fetchMessages;
$("findTasks").onclick = findTasks;
$("replyDraft").onclick = draftReplies;
$("autoPlan").onclick = autoplanFromInbox;
$("clearQueue").onclick = clearQueue;

$("runPrompt").onclick = runPrompt;
$("voicePrompt").onclick = () => recognition?.start();

$("startScreen").onclick = startScreen;
$("stopScreen").onclick = stopScreen;
$("analyzeScreen").onclick = analyzeScreen;

$("queueWorkflow").onclick = queueWorkflow;
$("runWorkflow").onclick = runWorkflow;

$("openSite").onclick = openSite;
$("playYouTube").onclick = playYouTube;
$("shopSearch").onclick = shopSearch;
$("solveHomework").onclick = solveHomework;
$("saveDoc").onclick = saveDoc;

$("agentStart").onclick = startAgentLoop;
$("agentStop").onclick = stopAgentLoop;
$("killSwitch").onclick = killAll;

log("Eryon runtime initialized. Configure integrations + start agent loop.");
