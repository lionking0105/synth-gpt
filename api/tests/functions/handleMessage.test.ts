import { mocked } from "jest-mock";
import { v4 as uuidv4 } from "uuid";
import { ChatRepository } from "../../src/repositories/ChatRepository";
import { buildHttpPostEvent, buildContext } from "./builders";
import { generateChatResponseAsync } from "../../src/proxies/openaiApiProxy";
import { formatJSONResponse } from "../../src/libs/api-gateway";
import { main } from "@functions/handleMessage/handler";

jest.mock("../../src/proxies/openaiApiProxy");
jest.mock("../../src/repositories/ChatRepository");

const generateChatResponseAsyncMock = mocked(generateChatResponseAsync);
const updateItemAsyncSpy = jest.spyOn(ChatRepository.prototype, "updateItemAsync");

describe("handleMessage handler", () => {
	const chatId = uuidv4();
	const title = "New chat";
	const handleMessage = "handleMessage";
	const context = buildContext(handleMessage);

	it("should return generated chat response message for new chat", async () => {
		const generatedResponse = {
			role: "assistant" as const,
			content: "Hello there! How may I assist you today?"
		};

		generateChatResponseAsyncMock.mockResolvedValue(generatedResponse);

		const body = { message: "hello" };
		const event = buildHttpPostEvent(`/${handleMessage}`, body, { id: chatId });
		const result = await main(event, context);

		expect(result).toHaveProperty("statusCode", 200);
		expect(JSON.parse(result.body).message).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				role: generatedResponse.role,
				content: generatedResponse.content,
				timestamp: expect.any(Number),
			}));
	});

	it("should add new item to chats db table", async () => {
		const userContent = "hello";
		const userTimestamp = 1678144804670;
		const assistantTimestamp = 1678144805170;

		const nowSpy = jest.spyOn(Date, "now");
		nowSpy.mockReturnValueOnce(userTimestamp);
		nowSpy.mockReturnValueOnce(assistantTimestamp);

		const userMessage = {
			id: uuidv4(),
			role: "user" as const,
			content: userContent,
			timestamp: userTimestamp,
		};

		const assistantResponse = {
			role: "assistant" as const,
			content: "Hello there! How may I assist you today?",
		};

		generateChatResponseAsyncMock.mockResolvedValue(assistantResponse);

		const event = buildHttpPostEvent(`/${handleMessage}`, userMessage, { chatId });
		await main(event, context);

		expect(updateItemAsyncSpy).toHaveBeenCalledWith({
			chatId,
			title,
			messages: [
				userMessage,
				expect.objectContaining({
					id: expect.any(String),
					role: assistantResponse.role,
					content: assistantResponse.content,
					timestamp: expect.any(Number),
				})
			],
			createdTime: expect.any(Number),
			updatedTime: expect.any(Number),
		});
	});

	it("should update existing item in chats db table", async () => {
		const createdTime = 1678144807000;
		const loadedMessages = [
			{
				id: uuidv4(),
				role: "user" as const,
				content: "hello",
				timestamp: 1678144806000,
			},
			{
				id: uuidv4(),
				role: "assistant" as const,
				content: "Hello there! How may I assist you today?",
				timestamp: createdTime,
			}
		];

		const getByChatIdAsyncMock = mocked(ChatRepository.prototype.getByChatIdAsync);
		getByChatIdAsyncMock.mockResolvedValue({
			chatId,
			title,
			messages: loadedMessages,
			createdTime,
			updatedTime: createdTime,
		});

		const userMessage = {
			id: uuidv4(),
			role: "user" as const,
			content: "how are you?",
			timestamp: Date.now(),
		};

		const assistantMessage = {
			role: "assistant" as const,
			content: [
				"As an artificial intelligence language model,",
				"I don't have feelings in the way humans do, but",
				"I'm always ready to assist you with any",
				"questions or tasks you might have.",
				"How can I help you today?"
			].join(" "),
		};

		generateChatResponseAsyncMock.mockResolvedValue(assistantMessage);

		const event = buildHttpPostEvent(`/${handleMessage}`, userMessage, { chatId });
		await main(event, context);

		expect(updateItemAsyncSpy).toHaveBeenCalledWith({
			chatId,
			title,
			messages: [
				loadedMessages[0],
				loadedMessages[1],
				userMessage,
				expect.objectContaining({
					id: expect.any(String),
					role: "assistant" as const,
					content: assistantMessage.content,
					timestamp: expect.any(Number),
				}),
			],
			createdTime,
			updatedTime: expect.any(Number),
		});
	});

	it("should return error response on failure to generate chat response", async () => {
		const error = "An unexpected error occurred whilst processing your request";
		generateChatResponseAsyncMock.mockRejectedValue(
			new Error(error)
		);

		const userMessage = {
			id: uuidv4(),
			role: "user" as const,
			content: "how are you feeling?",
			timestamp: Date.now(),
		};

		const event = buildHttpPostEvent(`/${handleMessage}`, userMessage, { chatId });
		const result = await main(event, context);

		expect(result).toEqual(formatJSONResponse({
			error,
		}, 500));
	});
});
