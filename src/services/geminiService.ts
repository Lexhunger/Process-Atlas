import { GoogleGenAI, Type } from "@google/genai";
import { usageService } from "./usageService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedProcess {
  nodes: {
    id: string;
    title: string;
    description: string;
    type: 'default' | 'trigger' | 'action' | 'decision' | 'end';
  }[];
  edges: {
    source: string;
    target: string;
    label: string;
  }[];
}

export const geminiService = {
  async generateProcess(prompt: string, existingContext?: { nodes: any[], edges: any[] }, model: string = "gemini-3.1-pro-preview"): Promise<GeneratedProcess> {
    const contextString = existingContext && existingContext.nodes.length > 0 
      ? `\n\nExisting Process Context:\nNodes: ${JSON.stringify(existingContext.nodes.map(n => ({ id: n.id, title: n.data.title, type: n.data.nodeType })))}\nEdges: ${JSON.stringify(existingContext.edges.map(e => ({ source: e.source, target: e.target, label: e.label })))}`
      : "";

    const response = await ai.models.generateContent({
      model: model,
      contents: `Generate or extend a process flowchart based on this request: "${prompt}". 
      ${contextString}
      
      If existing context is provided, you can:
      1. Add new nodes that connect to existing ones.
      2. Add new paths between existing nodes.
      3. Expand on specific parts of the existing process.
      
      Return a JSON object with ONLY the NEW nodes and NEW edges to be added. 
      Do not return the existing nodes/edges unless you are modifying them (in which case, include them with their original IDs).
      
      Nodes should have id, title, description, and type. 
      Types can be: 'trigger', 'action', 'decision', 'end'.
      Edges should have source, target, and label.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['trigger', 'action', 'decision', 'end'] }
                },
                required: ['id', 'title', 'description', 'type']
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ['source', 'target', 'label']
              }
            }
          },
          required: ['nodes', 'edges']
        }
      }
    });

    // Log usage
    if (response.usageMetadata) {
      usageService.logAIUsage(model, {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0
      }, 'generateProcess');
    }

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      throw new Error("Failed to generate process. Please try again.");
    }
  },

  async analyzeRepo(repoStructure: string, model: string = "gemini-3.1-pro-preview"): Promise<GeneratedProcess> {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Analyze the following GitHub repository structure and generate a process flowchart representing its architecture, data flow, or main logic:
      
      Repository Structure:
      ${repoStructure}
      
      Return a JSON object representing the process graph.
      Nodes should represent main components, modules, or steps in the system.
      Edges should represent dependencies, data flow, or execution order.
      
      Nodes should have id, title, description, and type. 
      Types can be: 'trigger', 'action', 'decision', 'end'.
      Edges should have source, target, and label.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['trigger', 'action', 'decision', 'end'] }
                },
                required: ['id', 'title', 'description', 'type']
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ['source', 'target', 'label']
              }
            }
          },
          required: ['nodes', 'edges']
        }
      }
    });

    // Log usage
    if (response.usageMetadata) {
      usageService.logAIUsage(model, {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0
      }, 'analyzeRepo');
    }

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      throw new Error("Failed to analyze repository. Please try again.");
    }
  },

  async generateRaw(prompt: string, model: string = "gemini-3-flash-preview"): Promise<string> {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    // Log usage
    if (response.usageMetadata) {
      usageService.logAIUsage(model, {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0
      }, 'generateRaw');
    }

    return response.text;
  }
};
