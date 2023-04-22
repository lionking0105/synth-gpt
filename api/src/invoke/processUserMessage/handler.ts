import { v4 as uuidv4 } from "uuid";
import { Handler } from "aws-lambda";
import { generateChatResponseAsync } from "@proxies/openaiApiProxy";
import { newChatText, prePrompt } from "../../constants";
import { postToConnectionAsync } from "@proxies/apiGatewayManagementApiClientProxy";
import { ChatRepository } from "@repositories/ChatRepository";
import TextToSpeechService from "@services/TextToSpeechService";

export const main: Handler = async (event) => {
	console.time("processUserMessage");

	try {
		const {
			connectionId,
			chatId,
			userId,
			message,
		} = event;

		const chatRepository = new ChatRepository();
		const chat = await chatRepository.getByChatIdAsync(chatId) ?? {
			chatId,
			title: newChatText,
			userId,
			messages: [],
			createdTime: Date.now(),
			updatedTime: Date.now(),
		};
		chat.messages.push(message);

		const { content } = await generateChatResponseAsync(
			[
				{
					role: "system" as const,
					content: prePrompt,
				},
				...chat.messages.map(msg => {
					return { role: msg.role, content: msg.content };
				})
			]
		);

		const assistantMessage = {
			id: uuidv4(),
			role: "assistant" as const,
			content,
			timestamp: Date.now(),
		};

		await postToConnectionAsync(connectionId, {
			type: "assistantMessage" as const,
			payload: {
				chatId,
				message: assistantMessage
			} as AssistantMessagePayload
		} as WebSocketMessage);

		const textToSpeechService = new TextToSpeechService();
		const transcript = content.replace(/```[\s\S]*?```/g, "");
		const audioUrl = await textToSpeechService.generateSignedAudioUrlAsync(transcript);

		await postToConnectionAsync(connectionId, {
			type: "assistantAudio" as const,
			payload: {
				chatId,
				transcript,
				audioUrl
			} as AssistantAudioPayload
		} as WebSocketMessage);

		chat.messages.push(assistantMessage);
		chat.updatedTime = Date.now();
		await chatRepository.updateItemAsync(chat);

		console.timeEnd("processUserMessage");
	}
	catch (error) {
		console.log(error, { level: "error" });
	}
};
