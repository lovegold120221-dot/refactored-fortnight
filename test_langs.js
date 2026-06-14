const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testLang(code) {
  try {
    const session = await ai.live.connect({
      model: "models/gemini-3.5-live-translate-preview",
      config: {
        responseModalities: ["AUDIO"],
        systemInstruction: {
          parts: [{ text: "You are a translator." }]
        },
        translationConfig: {
          targetLanguageCode: code,
          echoTargetLanguage: true
        }
      }
    });
    
    // Close session right after connect
    session.close();
    return true;
  } catch (err) {
    if (err.message.includes("targetLanguageCode")) return false;
    return false;
  }
}

async function main() {
  const codes = ["en", "fr", "ace", "af", "sq", "am", "ar", "hy", "az", "eu"];
  for (const code of codes) {
    const works = await testLang(code);
    console.log(`[TEST] ${code}: ${works}`);
  }
}

main();
