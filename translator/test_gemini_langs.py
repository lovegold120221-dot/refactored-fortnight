import asyncio
import json
import os
from dotenv import load_dotenv
import websockets

load_dotenv(".env.local")

GEMINI_WS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

async def test_lang(lang_code: str) -> bool:
    api_key = os.environ.get("GEMINI_API_KEY")
    url = f"{GEMINI_WS_URL}?key={api_key}"
    payload = {
        "setup": {
            "model": "models/gemini-3.5-live-translate-preview",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "translationConfig": {
                    "targetLanguageCode": lang_lang_code,
                    "echoTargetLanguage": True,
                },
            },
        }
    }
    
    try:
        async with websockets.connect(url) as ws:
            payload = {
                "setup": {
                    "model": "models/gemini-3.5-live-translate-preview",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "translationConfig": {
                            "targetLanguageCode": lang_code,
                            "echoTargetLanguage": True,
                        },
                    },
                }
            }
            await ws.send(json.dumps(payload))
            response = await ws.recv()
            data = json.loads(response)
            if "setupComplete" in data:
                return True
            if "error" in data:
                return False
            return True
    except websockets.exceptions.ConnectionClosedError as e:
        return False
    except Exception as e:
        return False

async def main():
    print("Testing 'en':", await test_lang("en"))
    print("Testing 'ace':", await test_lang("ace"))
    print("Testing 'pt-BR':", await test_lang("pt-BR"))

if __name__ == "__main__":
    asyncio.run(main())
