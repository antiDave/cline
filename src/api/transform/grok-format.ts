import { Anthropic } from "@anthropic-ai/sdk"
import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionCallPart,
    FunctionDeclaration,
    FunctionResponsePart,
    InlineDataPart,
    Part,
    SchemaType,
    TextPart,
} from "@google/generative-ai"

// Assuming these are the Grok-specific types we'll need (hypothetical)
interface GrokPart {
    text?: string;
    image?: { data: string; media_type: string };
    tool_call?: { id: string; name: string; arguments: Record<string, any> };
    tool_result?: { tool_call_id: string; content: string | any[] };
}

interface GrokMessage {
    role: "user" | "assistant" | "system";
    content: GrokPart[];
}

// Existing Gemini conversion functions remain unchanged
export function convertAnthropicContentToGemini(
    content:
        | string
        | Array<
              | Anthropic.Messages.TextBlockParam
              | Anthropic.Messages.ImageBlockParam
              | Anthropic.Messages.ToolUseBlockParam
              | Anthropic.Messages.ToolResultBlockParam
          >,
): Part[] {
    // ... existing implementation ...
}

// ... other existing Gemini functions ...

// New Grok conversion functions
export function convertAnthropicContentToGrok(
    content:
        | string
        | Array<
              | Anthropic.Messages.TextBlockParam
              | Anthropic.Messages.ImageBlockParam
              | Anthropic.Messages.ToolUseBlockParam
              | Anthropic.Messages.ToolResultBlockParam
          >,
): GrokPart[] {
    if (typeof content === "string") {
        return [{ text: content }];
    }
    return content.flatMap((block) => {
        switch (block.type) {
            case "text":
                return { text: block.text };
            case "image":
                if (block.source.type !== "base64") {
                    throw new Error("Unsupported image source type");
                }
                return {
                    image: {
                        data: block.source.data,
                        media_type: block.source.media_type,
                    },
                };
            case "tool_use":
                return {
                    tool_call: {
                        id: block.id,
                        name: block.name,
                        arguments: block.input,
                    },
                };
            case "tool_result":
                if (!block.content) {
                    return [];
                }
                return {
                    tool_result: {
                        tool_call_id: block.tool_use_id,
                        content: typeof block.content === "string" 
                            ? block.content 
                            : block.content.map(part => 
                                part.type === "text" 
                                    ? part.text 
                                    : { image: { data: part.source.data, media_type: part.source.media_type } }
                            ),
                    },
                };
            default:
                throw new Error(`Unsupported content block type: ${(block as any).type}`);
        }
    });
}

export function convertAnthropicMessageToGrok(message: Anthropic.Messages.MessageParam): GrokMessage {
    return {
        role: message.role === "assistant" ? "assistant" : "user", // Assuming Grok uses similar roles
        content: convertAnthropicContentToGrok(message.content),
    };
}

export function convertAnthropicToolToGrok(tool: Anthropic.Messages.Tool): any {
    // Assuming Grok has a similar tool/function declaration structure
    return {
        name: tool.name,
        description: tool.description || "",
        input_schema: {
            type: "object",
            properties: tool.input_schema.properties || {},
            required: tool.input_schema.required || [],
        },
    };
}

// Assuming we have a Grok response type (hypothetical)
interface GrokResponse {
    text?: string;
    tool_calls?: { id: string; name: string; arguments: Record<string, any> }[];
    usage: { input_tokens: number; output_tokens: number };
    stop_reason?: string;
}

export function convertGrokResponseToAnthropic(response: GrokResponse): Anthropic.Messages.Message {
    const content: Anthropic.Messages.ContentBlock[] = [];

    if (response.text) {
        content.push({ type: "text", text: response.text });
    }

    if (response.tool_calls) {
        response.tool_calls.forEach((call, index) => {
            content.push({
                type: "tool_use",
                id: call.id || `grok-tool-${index}-${Date.now()}`,
                name: call.name,
                input: call.arguments,
            });
        });
    }

    let stop_reason: Anthropic.Messages.Message["stop_reason"] = null;
    if (response.stop_reason) {
        switch (response.stop_reason.toLowerCase()) {
            case "end":
                stop_reason = "end_turn";
                break;
            case "max_tokens":
                stop_reason = "max_tokens";
                break;
            case "stop":
                stop_reason = "stop_sequence";
                break;
        }
    }

    return {
        id: `grok_${Date.now()}`,
        type: "message",
        role: "assistant",
        content,
        model: "grok",
        stop_reason,
        stop_sequence: null,
        usage: {
            input_tokens: response.usage?.input_tokens ?? 0,
            output_tokens: response.usage?.output_tokens ?? 0,
        },
    };
}
