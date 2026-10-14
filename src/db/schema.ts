export type ChatModel = {
  id: number;
  userId: string;
  title: string;
  model: string;
  initialPrompt: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MessagesModel = {
  id: number;
  clientId: string;
  chatId: number;
  role: "user" | "assistant";
  content: string;
};
