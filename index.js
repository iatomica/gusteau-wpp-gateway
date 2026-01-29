require("dotenv").config();
const axios = require("axios");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const qr = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = process.env.PORT;
const GUSTEAU_API_URL = process.env.GUSTEAU_API_URL;
const GUSTEAU_GATEWAY_URL = process.env.GUSTEAU_GATEWAY_URL;
const RESTAURANT_ID = process.env.RESTAURANT_ID; // Must be configured per instance
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN; // Token for authentication
const DEBUG_PHONE_NUMBER = process.env.DEBUG_PHONE_NUMBER; // Optional: Filter messages by phone number

// Paths
const baseStorage = path.join(__dirname, 'storage');
const authPath = path.join(baseStorage, '.wwebjs_auth');
const chromeProfile = path.join(baseStorage, 'chrome-profile');

if (!fs.existsSync(baseStorage)) fs.mkdirSync(baseStorage);
if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
if (!fs.existsSync(chromeProfile)) fs.mkdirSync(chromeProfile, { recursive: true });

// Clean locks
for (const f of ['SingletonLock','SingletonCookie','SingletonSockets','SingletonIPC','SS']) {
  try { fs.unlinkSync(path.join(chromeProfile, f)); } catch (_) {}
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: authPath }),
  puppeteer: {
    headless: true,
    args: [
      `--user-data-dir=${chromeProfile}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote'
    ],
  },
});

let lastQrString = "";

client.on("qr", (qrString) => {
  console.log(`QR Received on: ${GUSTEAU_GATEWAY_URL}/qr`);
  lastQrString = qrString;
});

client.on("ready", () => {
  console.log("✅ WhatsApp Client Ready!");
});

client.on("message", async (message) => {
  const chat = await message.getChat();

  // Ignore status groups for now
	if (chat.isGroup) {
		console.log(`↩️ Mensaje ignorado (grupo): ${chat.name || chat.id._serialized}`);
		return;
	}

  // If DEBUG_PHONE_NUMBER is set, only allow messages from that number
  if (DEBUG_PHONE_NUMBER && !message.from.includes(DEBUG_PHONE_NUMBER)) {
    console.log(`🚫 Ignoring message from ${message.from} (Debug Mode active for ${DEBUG_PHONE_NUMBER})`);
    return;
  }

  // Ignorar mensajes con archivos o imágenes
  if (message.hasMedia) {
    console.log(`🚫 Mensaje con media ignorado de ${message.from}`);
    await message.reply("Lo siento, no procesamos mensajes con archivos multimedia (imágenes, audios, documentos). Por favor enviame un mensaje de texto.");
    return;
  }

  console.log(`Message from ${message.from}: \n${message}`);

  try {
    const contact = await message.getContact();
    const cleanNumber = contact.number || contact.id.user;
    const name = contact.pushname || contact.name || message._data.notifyName || 'Unknown';
    console.log(`👤 Contact info - Number: ${cleanNumber}, Name: ${name}`);

    // Forward to Gusteau Backend
    data = {
      restaurantId: RESTAURANT_ID,
      platform: 'whatsapp_js',
      externalId: cleanNumber,
      customerName: name,
      content: message.body
    }
    console.log("➡️ Forwarding message to Gusteau:", data);
    await axios.post(`${GUSTEAU_API_URL}/messages/webhook`, {
      ...data
    });
  } catch (error) {
    console.error("❌ Failed to forward message to Gusteau:", error.message);
  }
});

client.initialize();

// --- EXPRESS SERVER ---
const app = express();
app.use(express.json());

// Middleware to validate authorization token
const authTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token." });
  }
  const token = authHeader.split(" ")[1];
  if (token !== GATEWAY_TOKEN) {
    return res.status(403).json({ error: "Invalid token." });
  }
  next();
};

// Endpoint to send messages (Called by Gusteau)
app.post("/send", authTokenMiddleware, async (req, res) => {
  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ error: "Missing 'to' or 'message'" });
  }

  try {
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const chat = await client.getChatById(chatId);
    
    // Stop typing when sending a message
    await chat.clearState();

    await client.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Endpoint to manage chat state (typing, recording, clear)
app.post("/chat/state", authTokenMiddleware, async (req, res) => {
  const { to, state } = req.body;

  if (!to || !state) {
    return res.status(400).json({ error: "Missing 'to' or 'state'" });
  }

  try {
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const chat = await client.getChatById(chatId);

    switch (state) {
      case 'typing':
        await chat.sendStateTyping();
        break;
      case 'recording':
        await chat.sendStateRecording();
        break;
      case 'clear':
        await chat.clearState();
        break;
      default:
        return res.status(400).json({ error: "Invalid state. Use 'typing', 'recording', or 'clear'" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ Error setting chat state to ${state}:`, error);
    res.status(500).json({ error: "Failed to update chat state" });
  }
});

// QR Endpoint
app.get("/qr", async (_req, res) => {
  if (!lastQrString) return res.send("Waiting for QR...");
  try {
    const qrImage = await qr.toDataURL(lastQrString);
    res.send(`<img src="${qrImage}" />`);
  } catch (e) {
    res.status(500).send("Error generating QR");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Gateway running on ${GUSTEAU_GATEWAY_URL}`);
});
