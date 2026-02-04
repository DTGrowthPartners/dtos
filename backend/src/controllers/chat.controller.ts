import { Request, Response } from 'express';
import OpenAI from 'openai';
import { AI_TOOLS } from '../config/aiTools';
import { AIToolsService } from '../services/aiTools.service';

// Configure Kimi AI client via Hugging Face
const kimiClient = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

export class ChatController {
  // Send a message to Kimi AI and get a response
  async sendMessage(req: Request, res: Response) {
    try {
      const { message, conversationHistory } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log('[Chat] Processing message:', message);

      // Build messages array with conversation history
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current user message
      messages.push({ role: "user", content: message });

      // Call Kimi AI
      const completion = await kimiClient.chat.completions.create({
        model: "moonshotai/Kimi-K2.5:novita",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      let response = completion.choices[0].message.content || '';

      // Filter out thinking tags and content if present
      if (response.includes('</think>')) {
        response = response.split('</think>').pop()?.trim() || response;
      }

      console.log('[Chat] Response generated successfully');

      res.json({
        success: true,
        response: response,
        usage: completion.usage,
      });

    } catch (error: any) {
      console.error('[Chat] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al procesar el mensaje'
      });
    }
  }

  // Analyze an image with Kimi AI vision capabilities
  async analyzeImage(req: Request, res: Response) {
    try {
      const { imageUrl, prompt } = req.body;

      if (!imageUrl || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'Image URL and prompt are required'
        });
      }

      console.log('[Chat] Analyzing image:', imageUrl);

      const completion = await kimiClient.chat.completions.create({
        model: "moonshotai/Kimi-K2.5:novita",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      let response = completion.choices[0].message.content || '';

      // Filter out thinking tags and content if present
      if (response.includes('</think>')) {
        response = response.split('</think>').pop()?.trim() || response;
      }

      console.log('[Chat] Image analysis completed');

      res.json({
        success: true,
        response: response,
        usage: completion.usage,
      });

    } catch (error: any) {
      console.error('[Chat] Image analysis error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al analizar la imagen'
      });
    }
  }

  // Send a message to Kimi AI with Function Calling (tools) support
  async sendMessageWithTools(req: Request, res: Response) {
    try {
      const { message, conversationHistory } = req.body;
      const userId = (req as any).user.userId;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log('[Chat] Processing message with tools:', message, 'for user:', userId);

      // Build messages array with system prompt
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `Eres Kimi AI, asistente inteligente de DT Growth Partners. Tienes acceso a datos del sistema mediante herramientas.

IMPORTANTE - Estilo de respuesta:
- Responde de forma CONCISA y DIRECTA, máximo 3-4 líneas por pregunta
- NO uses tablas markdown, NO uses emojis excesivos
- Si hay muchos datos, resume con números clave y ofrece detallar después
- Usa saltos de línea simples para separar información
- Formato simple: usa guiones (-) para listas cortas si es necesario
- Sé conversacional y natural, como un compañero de equipo

Ejemplo BUENO:
"Dairo tiene 33 tareas en total:
- 5 de alta prioridad (incluye reunión finanzas y propuesta Diana Barrios)
- 12 de prioridad media (marketing y automatización)
- El resto completadas o en progreso
¿Quieres ver alguna tarea específica?"

Ejemplo MALO (NO hagas esto):
Tablas largas con formato markdown, resúmenes ejecutivos con muchas secciones, emojis en cada línea.`
        }
      ];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current user message
      messages.push({ role: "user", content: message });

      let iterations = 0;
      const MAX_ITERATIONS = 5;
      const aiToolsService = new AIToolsService();

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[Chat] Iteration ${iterations}/${MAX_ITERATIONS}`);

        // Call Kimi AI with tools
        const completion = await kimiClient.chat.completions.create({
          model: "moonshotai/Kimi-K2.5:novita",
          messages: messages,
          tools: AI_TOOLS as any,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 2000,
        });

        const assistantMessage = completion.choices[0].message;

        // Check if there are tool calls
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          // No tool calls - return final response
          let response = assistantMessage.content || '';

          // Filter out thinking tags
          if (response.includes('</think>')) {
            response = response.split('</think>').pop()?.trim() || response;
          }

          console.log('[Chat] Final response generated (no tools used)');

          return res.json({
            success: true,
            response: response,
            usage: completion.usage,
          });
        }

        console.log(`[Chat] Tool calls requested: ${assistantMessage.tool_calls.length}`);

        // Add assistant message to history
        messages.push({
          role: "assistant",
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls as any
        });

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const toolName = (toolCall as any).function.name;
            const toolArgs = JSON.parse((toolCall as any).function.arguments);

            console.log(`[Chat] Executing tool: ${toolName}`, toolArgs);

            const result = await aiToolsService.executeTool(toolName, toolArgs, userId);

            console.log(`[Chat] Tool ${toolName} executed successfully`);

            // Add tool result to messages
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            } as any);
          } catch (error: any) {
            console.error('[Chat] Tool execution error:', error);

            // Add error result
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: `Error al ejecutar la herramienta: ${error.message}`
              })
            } as any);
          }
        }
      }

      // Max iterations reached
      console.log('[Chat] Max iterations reached');

      return res.json({
        success: true,
        response: "Necesito más tiempo para procesar esta solicitud. ¿Puedes reformular tu pregunta?",
      });

    } catch (error: any) {
      console.error('[Chat] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al procesar el mensaje'
      });
    }
  }
}
