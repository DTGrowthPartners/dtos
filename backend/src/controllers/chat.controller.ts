import { Request, Response } from 'express';
import OpenAI from 'openai';

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

      const response = completion.choices[0].message.content;

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

      const response = completion.choices[0].message.content;

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
}
