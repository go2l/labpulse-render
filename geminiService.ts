
import { GoogleGenAI, Type } from "@google/genai";
import { AiSettings, ResearchPlanDraft, TableAiAction, TaskStatus, Experiment, Task, ChatMessage } from "./types";
import { format } from "date-fns";
import { TranslationDictionary } from "./types/i18n";

/**
 * Service to interact with the Google Gemini API.
 * Accepts an optional apiKey parameter to support user-provided keys.
 */
const getAiClient = (apiKey?: string) => {
  return new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY || '' });
};

/**
 * Helper to construct the Style & Persona instruction block
 */
const getPersonaInstruction = (settings: AiSettings, language: string) => {
  const styleInstructions = {
    professional: "Tone: Formal, Business-oriented. Focus: Actionable insights, clear bottom lines. Vocabulary: Professional industry terms.",
    academic: "Tone: Rigorous, Scientific, Objective. Focus: Methodology, Analysis, Critical thinking. Vocabulary: Academic/Scientific terminology.",
    casual: "Tone: Friendly, Accessible, Conversational. Focus: Simplicity and engagement. Vocabulary: Simple, everyday language.",
    concise_technical: "Tone: Dry, Direct, Technical. Focus: Facts, Data, Efficiency. Vocabulary: Precise technical terms. No fluff."
  };

  const explicitInclusions = [];
  if (settings.showAssumptions) explicitInclusions.push("Explicitly state WORKING ASSUMPTIONS used to derive the answer.");
  if (settings.showMethodology) explicitInclusions.push("Briefly outline the METHODOLOGY or logical approach taken.");
  if (settings.showReservations) explicitInclusions.push("Explicitly mention RESERVATIONS, limitations, or potential biases.");

  return `
    *** AI PERSONA CONFIGURATION ***
    - RESPONSE LANGUAGE: ${language === 'he' ? 'Hebrew' : 'English'}
    - SELECTED STYLE: ${settings.aiStyle}
    - STYLE GUIDELINES: ${styleInstructions[settings.aiStyle as keyof typeof styleInstructions] || styleInstructions.professional}
    - DETAIL LEVEL: ${settings.aiDetailLevel} (Reference: concise=brief summaries, balanced=standard paragraphs, comprehensive=deep dive).
    
    ${explicitInclusions.length > 0 ? `*** REQUIRED SECTIONS (MUST INCLUDE) ***\n- ${explicitInclusions.join('\n- ')}` : ''}

    *** USER CUSTOM INSTRUCTIONS ***
    ${settings.customSystemInstructions ? `USER NOTE: "${settings.customSystemInstructions}". (This overrides default style rules if conflicting).` : 'None provided.'}
    
    *** FORMATTING RULES ***
    - Maintain consistency with the selected style.
    - If style is 'academic', use citations or references to general principles where appropriate.
  `;
};

/**
 * Handles errors from the AI service, parsing JSON error messages if present.
 */
const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error Details:", error);

  let message = "An unknown error occurred with the AI service.";

  // Attempt to parse if it's a string representation of JSON
  if (typeof error.message === 'string' && error.message.includes('{')) {
    try {
      const jsonPart = error.message.substring(error.message.indexOf('{'));
      const parsed = JSON.parse(jsonPart);
      if (parsed.error && parsed.error.message) {
        message = parsed.error.message;
      }
    } catch (e) {
      // Fallback to original message
      message = error.message;
    }
  } else if (error.message) {
    message = error.message;
  }

  // Check for specific codes
  if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
    throw new Error(`AI Quota Exceeded (${message}). Please try again later or switch to a different model in settings.`);
  }

  throw new Error(message);
};

/**
 * Safely calls the Gemini API with centralized error handling.
 */
const safeGenerateContent = async (settings: AiSettings, model: string, contents: any, config: any) => {
  try {
    const ai = getAiClient(settings.apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    });
    return response;
  } catch (error) {
    handleGeminiError(error);
  }
};

/**
 * Analyzes a research proposal text and generates a structured work plan.
 */
export const generatePlanFromProposal = async (
  settings: AiSettings,
  proposalText: string,
  t: TranslationDictionary,
  language: string
): Promise<ResearchPlanDraft> => {
  if (settings.mockMode) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      objectives: [t.aiMock.planResponse, t.aiMock.phaseExec],
      phases: [{ name: t.aiMock.phasePrep, durationWeeks: 1 }, { name: t.aiMock.phaseExec, durationWeeks: 4 }],
      tasks: [
        { title: t.aiMock.taskTitle, description: t.aiMock.taskDesc, weekOffset: 0, importance: 4, status: TaskStatus.IMPORTANT, tags: [] },
        { title: t.aiMock.taskTitle + " 2", description: t.aiMock.taskDesc, weekOffset: 1, importance: 5, status: TaskStatus.IMPORTANT, tags: [], dependsOnTaskIndex: [0] },
      ]
    };
  }

  const response = await safeGenerateContent(
    settings,
    settings.modelStructured || 'gemini-1.5-flash',
    `Analyze the following research proposal and generate a structured work plan.
    ${getPersonaInstruction(settings, language)}
    
    Proposal Text: ${proposalText}
    
    Instructions:
    1. Break down the plan into objectives and phases.
    2. Identify specific tasks.
    3. If a task is recurring (e.g., "measure every week"), use the 'recurrence' field.
    4. If a task logically depends on another (e.g., "Analysis" after "Data Collection"), indicate it using 'dependsOnTaskIndex' (0-based index of the task in your output list).
    `,
    {
      temperature: settings.temperature,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          phases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                durationWeeks: { type: Type.NUMBER }
              },
              required: ["name", "durationWeeks"]
            }
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                weekOffset: { type: Type.NUMBER },
                importance: { type: Type.NUMBER },
                status: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                recurrence: {
                  type: Type.OBJECT,
                  properties: {
                    frequency: { type: Type.STRING, enum: ['weekly'] },
                    count: { type: Type.NUMBER }
                  }
                },
                dependsOnTaskIndex: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                }
              },
              required: ["title", "weekOffset"]
            }
          }
        },
        required: ["objectives", "phases", "tasks"]
      }
    }
  );

  return JSON.parse(response.text || '{}');
};

/**
 * Conducts a chat turn for research proposal refinement.
 */
export const runProposalChat = async (
  settings: AiSettings,
  proposalText: string,
  history: ChatMessage[],
  userMessage: string,
  t: TranslationDictionary,
  language: string
): Promise<string> => {
  if (settings.mockMode) {
    return "This is a mock response asking a clarifying question about your methodology.";
  }

  const ai = getAiClient(settings.apiKey);
  const context = `
    You are an expert Research Consultant conducting an interview to refine a research plan.
    
    Research Proposal: "${proposalText}"
    
    Goal: Ask 1 (ONE) relevant, deep, and specific question to clarify ambiguities, methodology, or resources needed for the experiment.
    
    Guidelines:
    - Keep it professional and concise.
    - Ask only one question at a time.
    - If the user provides a short answer, probe deeper.
    - Do not generate the plan yet, just interview.
    
    ${getPersonaInstruction(settings, language)}
  `;

  const historyContents = [
    { role: 'user', parts: [{ text: context }] },
    { role: 'model', parts: [{ text: t.aiMock ? "Understood. I am ready to interview." : "I am ready." }] },
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const response = await safeGenerateContent(
    settings,
    settings.modelText || 'gemini-1.5-flash',
    historyContents,
    {
      temperature: settings.temperature
    }
  );

  return response.text || '';
};


/**
 * Generates a plan using both proposal and chat history.
 */
export const generatePlanFromProposalAndChat = async (
  settings: AiSettings,
  proposalText: string,
  chatHistory: ChatMessage[],
  t: TranslationDictionary,
  language: string
): Promise<ResearchPlanDraft> => {
  if (settings.mockMode) {
    return generatePlanFromProposal(settings, proposalText, t, language);
  }

  const historyText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

  /* const ai = getAiClient(settings.apiKey); */
  const response = await safeGenerateContent(
    settings,
    settings.modelStructured || 'gemini-1.5-flash',
    `Analyze the following research proposal AND the interview transcript to generate a structured work plan.
    Use the clarifications from the interview to create a more precise and customized plan.

    ${getPersonaInstruction(settings, language)}
    
    Proposal Text: ${proposalText}

    Interview Transcript:
    ${historyText}
    
    Instructions:
    1. Break down the plan into objectives and phases.
    2. Identify specific tasks.
    3. If a task is recurring (e.g., "measure every week"), use the 'recurrence' field.
    4. If a task logically depends on another (e.g., "Analysis" after "Data Collection"), indicate it using 'dependsOnTaskIndex' (0-based index of the task in your output list).
    `,
    {
      temperature: settings.temperature,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          phases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                durationWeeks: { type: Type.NUMBER }
              },
              required: ["name", "durationWeeks"]
            }
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                weekOffset: { type: Type.NUMBER },
                importance: { type: Type.NUMBER },
                status: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                recurrence: {
                  type: Type.OBJECT,
                  properties: {
                    frequency: { type: Type.STRING, enum: ['weekly'] },
                    count: { type: Type.NUMBER }
                  }
                },
                dependsOnTaskIndex: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                }
              },
              required: ["title", "weekOffset"]
            }
          }
        },
        required: ["objectives", "phases", "tasks"]
      }
    }
  );

  return JSON.parse(response.text || '{}');
};



/**
 * Refines an existing plan based on new user input from the chat.
 * This should be fast and targeted.
 */
export const refineResearchPlan = async (
  settings: AiSettings,
  currentPlan: ResearchPlanDraft,
  proposalText: string,
  chatHistory: ChatMessage[],
  latestUserMessage: string,
  t: TranslationDictionary,
  language: string
): Promise<ResearchPlanDraft> => {
  if (settings.mockMode) {
    return currentPlan; // No-op in mock
  }

  const historyText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const response = await safeGenerateContent(
    settings,
    settings.modelStructured || 'gemini-1.5-pro', // Use a smart model for this complex diffing
    `You are an expert Research Planner. You have an existing Research Plan and a new piece of information from the user during an interview.
    
    Goal: Update the Research Plan to reflect the new information.
    - If the user changed a timeline, update 'durationWeeks' or 'weekOffset'.
    - If the user added a constraint (e.g., "no work on Fridays", "need 2 weeks for prep"), add/modify tasks.
    - If the new info is irrelevant to the structure (e.g., just chat), return the plan UNCHANGED.
    
    Current Plan (JSON):
    ${JSON.stringify(currentPlan, null, 2)}
    
    Original Proposal: ${proposalText.substring(0, 500)}...
    
    Interview Context:
    ${historyText}
    
    LATEST USER INPUT: "${latestUserMessage}"
    
    Instructions:
    - Return the FULL updated JSON object.
    - Maintain the schema exactly.
    - Do NOT be destructive unless explicitly asked.
    
    ${getPersonaInstruction(settings, language)}
    `,
    {
      temperature: 0.1, // Low temperature for stability
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          phases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                durationWeeks: { type: Type.NUMBER }
              },
              required: ["name", "durationWeeks"]
            }
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                weekOffset: { type: Type.NUMBER },
                importance: { type: Type.NUMBER },
                status: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                recurrence: {
                  type: Type.OBJECT,
                  properties: {
                    frequency: { type: Type.STRING, enum: ['weekly'] },
                    count: { type: Type.NUMBER }
                  }
                },
                dependsOnTaskIndex: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                }
              },
              required: ["title", "weekOffset"]
            }
          }
        },
        required: ["objectives", "phases", "tasks"]
      }
    }
  );

  return JSON.parse(response.text || '{}');
};

/**
 * Generates professional guiding questions.
 */
export const getGuidingQuestions = async (
  settings: AiSettings,
  context: string,
  t: TranslationDictionary,
  language: string
): Promise<string[]> => {
  if (settings.mockMode) {
    return [
      t.aiMock.queryResponse + " 1?",
      t.aiMock.queryResponse + " 2?",
      t.aiMock.queryResponse + " 3?"
    ];
  }

  const ai = getAiClient(settings.apiKey);
  const randomSeed = Math.floor(Math.random() * 10000); // Ensure freshness
  const response = await ai.models.generateContent({
    model: settings.modelText || 'gemini-1.5-flash',
    contents: `Generate ${settings.numGuidingQuestions} highly specific and professional guiding questions for the following research task.
    The questions should help the researcher improve the execution or data collection of THIS SPECIFIC TASK.
    
    Context Provided: "${context}"
    
    Random Seed: ${randomSeed}
    
    ${getPersonaInstruction(settings, language)}`,
    config: {
      temperature: settings.temperature,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["questions"]
      }
    }
  });

  const result = JSON.parse(response.text || '{}');
  return result.questions || [];
};

/**
 * Smartly incorporates a user's answer into an existing description.
 */
export const smartRefineDescription = async (
  settings: AiSettings,
  currentDescription: string,
  question: string,
  userAnswer: string,
  t: TranslationDictionary,
  language: string
): Promise<string> => {
  if (settings.mockMode) {
    // Simulate a rewrite instead of append
    return `[${t.common.edit}] ${currentDescription}. ${question}: ${userAnswer}. (${t.aiMock.planResponse})`;
  }

  /* const ai = getAiClient(settings.apiKey); */
  const response = await safeGenerateContent(
    settings,
    settings.modelText || 'gemini-2.0-flash-exp',
    `
    You are a professional scientific editor.
    Your mission is to **REWRITE** the "Description" to seamlessly incorporate the "New Information".
    
    Old Description: "${currentDescription}"
    Context Question: "${question}"
    New Information (User Answer): "${userAnswer}"
    
    Directives:
    1. **Do NOT simply append** the new information at the end.
    2. Weave the new information into the text so it flows naturally as a single, coherent description.
    3. Improve the overall clarity and professional tone of the Hebrew text.
    4. Keep the text concise but comprehensive.
    5. Return ONLY the new description text.
    
    ${getPersonaInstruction(settings, language)}
    `,
    {
      temperature: settings.temperature
    }
  );

  return response.text || currentDescription;
};

/**
 * Interprets a natural language prompt to perform an action on the experiment board.
 */
export const getTableAction = async (
  settings: AiSettings,
  prompt: string,
  experiments: Experiment[],
  allTasks: Task[],
  t: TranslationDictionary,
  language: string
): Promise<TableAiAction> => {

  const contextSummary = JSON.stringify({
    currentDate: format(new Date(), 'yyyy-MM-dd'),
    experiments: experiments.map(e => ({ id: e.id, name: e.name })),
    tasks: allTasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      date: t.weekId,
      importance: t.importance,
      completed: t.completed,
      experimentId: t.experimentId
    }))
  });

  if (settings.mockMode) {
    if (prompt.includes(t.reports.task) || prompt.includes("Task")) {
      return {
        action: 'add_task',
        payload: {
          taskData: { title: t.aiMock.taskTitle, description: t.aiMock.taskDesc },
          experimentId: experiments[0]?.id,
          weekOffset: 1
        },
        textResponse: t.aiMock.planResponse + ": " + t.common.new,
      };
    }
    return {
      action: 'query',
      payload: {},
      textResponse: t.aiMock.queryResponse + " " + allTasks.length + " " + t.reports.task,
    };
  }


  /* const ai = getAiClient(settings.apiKey); */
  const response = await safeGenerateContent(
    settings,
    settings.modelStructured || 'gemini-3-pro-preview',
    `
    Context Data: ${contextSummary}
    
    User Request: ${prompt}`,
    {
      temperature: settings.temperature,
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: "add_experiment | add_task | edit_task | delete_task | query | none" },
          payload: {
            type: Type.OBJECT,
            properties: {
              experimentId: { type: Type.STRING },
              taskId: { type: Type.STRING },
              weekOffset: { type: Type.NUMBER },
              taskData: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Specific title extracted from prompt" },
                  description: { type: Type.STRING },
                  status: { type: Type.STRING },
                  importance: { type: Type.NUMBER }
                }
              },
              experimentData: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            }
          },
          textResponse: { type: Type.STRING, description: "Polite confirmation or the answer to the query." }
        },
        required: ["action", "textResponse", "payload"]
      }
    }
  );

  return JSON.parse(response.text || '{}');
};

/**
 * Generates a high-level summary.
 */
export const generateSummary = async (
  settings: AiSettings,
  type: 'weekly' | 'monthly' | 'experiment',
  data: string,
  t: TranslationDictionary,
  language: string
): Promise<string> => {
  if (settings.mockMode) {
    return `${t.aiMock.planResponse} (${type})...`;
  }

  const ai = getAiClient(settings.apiKey);
  const response = await ai.models.generateContent({
    model: settings.modelText || 'gemini-1.5-flash',
    contents: `Provide a summary for ${type} based on the following task data: ${data}.
    ${getPersonaInstruction(settings, language)}`,
    config: {
      temperature: settings.temperature
    }
  });

  return response.text || '';
};

/**
 * Generates a "Methods & Materials" style report for a specific experiment.
 */
export const generateExperimentReport = async (
  settings: AiSettings,
  experiment: Experiment,
  tasks: Task[],
  t: TranslationDictionary,
  language: string
): Promise<string> => {
  if (settings.mockMode) {
    return t.aiMock.reportResponse;
  }

  const expData = JSON.stringify({
    name: experiment.name,
    description: experiment.description,
    startDate: experiment.startDate,
    tasks: tasks.filter(t => t.experimentId === experiment.id).map(t => ({
      date: t.weekId,
      title: t.title,
      description: t.description,
      status: t.status,
      completed: t.completed
    }))
  });

  /* const ai = getAiClient(settings.apiKey); */
  const response = await safeGenerateContent(
    settings,
    settings.modelStructured || 'gemini-3-pro-preview',
    `
    You are a scientific research assistant. 
    Write a "Materials and Methods" and "Experimental Procedure" summary report based on the provided experiment data.
    
    Data: ${expData}
    
    ${getPersonaInstruction(settings, language)}

    Guidelines (Override only if User Custom Instructions disagree):
    - Include a chronological timeline of what was done based on the tasks and their completion status.
    - Mention specific dates.
    `,
    {
      temperature: settings.temperature
    }
  );

  return response.text || t.common.error;
};
