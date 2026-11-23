import { GoogleGenAI } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface CoachContext {
  date: string;
  timezone: string;
  disciplineScore: number;
  disciplineStatus: string;
  completedBlocks: number;
  totalBlocks: number;
  habitRatePercent: number;
  focusMinutesToday: number;
  waterMlToday: number;
  sleepHoursToday: number;
  recentMood: string;
  activeGoals: string[];
  level: number;
  rank: string;
}

export async function generateCoachReply(params: {
  userMessage: string;
  history: Array<{ role: string; content: string }>;
  context: CoachContext;
}): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are AROHA AI, an analytical, stoic, zero-fluff tactical discipline coach.
Respond with precision, clarity, and actionable next steps. Never use filler pleasantries, emojis, or generic encouragement.
Treat discipline as an engineering system: diagnose bottlenecks, optimize time blocks, enforce biological recovery (sleep/hydration), and hold the operator accountable to data.
Keep responses crisp (2-4 short paragraphs or tight tactical bullet points).

LIVE OPERATOR TELEMETRY:
- Date: ${params.context.date} (${params.context.timezone})
- Rank & Level: ${params.context.rank} (Level ${params.context.level})
- Discipline Score: ${params.context.disciplineScore}/100 (${params.context.disciplineStatus})
- Schedule Execution Today: ${params.context.completedBlocks}/${params.context.totalBlocks} blocks completed
- Habit Check-In Rate Today: ${params.context.habitRatePercent}%
- Deep Focus Today: ${params.context.focusMinutesToday} minutes
- Biological Inputs: ${params.context.waterMlToday} ml water, ${params.context.sleepHoursToday}h sleep
- Recent Journal Mood: ${params.context.recentMood}
- Active Goals: ${params.context.activeGoals.length > 0 ? params.context.activeGoals.join('; ') : 'None logged'}`;

  const recentTranscript = params.history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'OPERATOR' : 'AROHA'}: ${m.content}`)
    .join('\n\n');

  const prompt = recentTranscript
    ? `${recentTranscript}\n\nOPERATOR: ${params.userMessage}\n\nAROHA:`
    : `OPERATOR: ${params.userMessage}\n\nAROHA:`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  const reply = response.text?.trim();
  if (!reply) {
    throw new Error('Empty response returned by Gemini model.');
  }
  return reply;
}
