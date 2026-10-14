import { mkdirSync } from "node:fs";
import path from "node:path";
import { createChatStore } from "./store";

// Reuse the connection across Next.js server module reloads.
const sqliteGlobal = globalThis as typeof globalThis & {
  chatStore?: ReturnType<typeof createChatStore>;
};
function getStore() {
  if (!sqliteGlobal.chatStore) {
    const dataDirectory = path.join(process.cwd(), "data");
    mkdirSync(dataDirectory, { recursive: true });
    sqliteGlobal.chatStore = createChatStore(path.join(dataDirectory, "chat.sqlite"));
  }
  return sqliteGlobal.chatStore;
}

type Store = ReturnType<typeof createChatStore>;
export const createChat: Store["createChat"] = (...args) => getStore().createChat(...args);
export const getChat: Store["getChat"] = (...args) => getStore().getChat(...args);
export const getChats: Store["getChats"] = (...args) => getStore().getChats(...args);
export const updateChat: Store["updateChat"] = (...args) => getStore().updateChat(...args);
export const deleteChat = (...args: Parameters<Store["deleteChat"]>) => getStore().deleteChat(...args);
export const getMessagesByChatId: Store["getMessages"] = (...args) => getStore().getMessages(...args);
export const appendUserMessage = (...args: Parameters<Store["appendUserMessage"]>) => getStore().appendUserMessage(...args);
export const saveReply = (...args: Parameters<Store["saveReply"]>) => getStore().saveReply(...args);
