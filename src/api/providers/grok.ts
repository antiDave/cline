import { ApiHandler } from "../"
import { ApiHandlerOptions, grokDefaultModelId, GrokModelId, grokModels, ModelInfo } from "../../shared/api"
import { withRetry } from "../retry"
import { ApiStream } from "../transform/stream"

// Assuming xAI provides an SDK similar to other AI providers
import { xAI } from "@xai/sdk"

export class GrokHandler implements ApiHandler {
    private options: ApiHandlerOptions
    private client: xAI

    constructor(options: ApiHandlerOptions) {
        if (!options.grokApiKey) {
            throw new Error("API key is required for xAI Grok")
        }
        this.options = options
        this.client = new xAI(options.grokApiKey)
    }

    @withRetry()
    async *createMessage(systemPrompt: string, messages: any[]): ApiStream {
        const model = this.client.getGenerativeModel({
            model: this.getModel().id,
            systemPrompt: systemPrompt, // Assuming Grok API accepts system prompt this way
        })

        const result = await model.generateContentStream({
            messages: messages, // Assuming messages are already in a compatible format
            generationConfig: {
                temperature: 0.7, // Reasonable default for Grok, adjustable
            },
        })

        for await (const chunk of result.stream) {
            yield {
                type: "text",
                text: chunk.text(),
            }
        }

        const response = await result.response
        yield
