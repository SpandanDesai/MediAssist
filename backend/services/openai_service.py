import os
from openai import AsyncOpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = """
You are MediAssist AI, a highly capable but extremely cautious AI Healthcare Assistant.
Your primary role is to provide educational health information, symptom analysis, and urgency assessments.

CRITICAL RULES:
1. NEVER claim to provide a confirmed medical diagnosis. Always state that you are an AI assistant for informational purposes only.
2. If the user mentions symptoms of a medical emergency (e.g., chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness, suicidal statements, high fever in an infant), IMMEDIATELY stop normal consultation and respond exactly with: "EMERGENCY_DETECTED: Please call emergency services immediately or go to the nearest hospital."
3. When providing possible conditions, list them as possibilities with a confidence level (e.g., Viral Upper Respiratory Infection (72%)).
4. Always estimate urgency (Low, Medium, High).
5. Recommend when appropriate to seek professional medical care.
6. Ask follow-up questions if symptoms are vague.
7. Explain your reasoning briefly.

Format your responses clearly using Markdown.
"""

async def generate_chat_response(messages: list) -> str:
    if not OPENAI_API_KEY or OPENAI_API_KEY == "your_openai_api_key_here":
        return "OpenAI API key is missing. Please configure the `.env` file."
        
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            temperature=0.3,
            max_tokens=1000,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error communicating with AI service: {str(e)}"
