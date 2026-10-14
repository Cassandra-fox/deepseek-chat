import Database from "better-sqlite3";
import type { ChatModel, MessagesModel } from "./schema";

type Row = Record<string, unknown>;

export function createChatStore(filename: string) {
  const db = new Database(filename, { timeout: 5000 });
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      title TEXT NOT NULL, model TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);
  `);
  // Upgrade existing local files in place, preserving chats and messages.
  db.transaction(() => {
    const columns = new Set((db.pragma("table_info(chats)") as Row[]).map(row => row.name));
    for (const [name, definition] of [
      ["is_pinned", "INTEGER NOT NULL DEFAULT 0"],
      ["initial_prompt", "TEXT NOT NULL DEFAULT ''"],
      ["created_at", "INTEGER NOT NULL DEFAULT 0"],
      ["updated_at", "INTEGER NOT NULL DEFAULT 0"],
    ]) {
      if (!columns.has(name)) db.exec(`ALTER TABLE chats ADD COLUMN ${name} ${definition}`);
    }
    const messageColumns = new Set((db.pragma("table_info(messages)") as Row[]).map(row => row.name));
    if (!messageColumns.has("client_id")) db.exec("ALTER TABLE messages ADD COLUMN client_id TEXT");
    db.prepare("UPDATE chats SET initial_prompt = title WHERE initial_prompt = ''").run();
    db.prepare("UPDATE chats SET created_at = ?, updated_at = ? WHERE created_at = 0").run(Date.now(), Date.now());
    db.exec(`
      UPDATE messages SET client_id = 'stored-' || id WHERE client_id IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS messages_client_id_idx ON messages(chat_id, client_id);
    `);
  }).immediate();
  const toChat = (row: Row): ChatModel => ({
    id: Number(row.id), userId: String(row.user_id), title: String(row.title),
    model: String(row.model), initialPrompt: String(row.initial_prompt),
    isPinned: Boolean(row.is_pinned), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
  });
  const toMessage = (row: Row): MessagesModel => ({
    id: Number(row.id), chatId: Number(row.chat_id), clientId: String(row.client_id),
    role: row.role === "assistant" ? "assistant" : "user", content: String(row.content),
  });
  const getChat = (chatId: number, userId: string) => {
    const row = db.prepare("SELECT * FROM chats WHERE id = ? AND user_id = ?").get(chatId, userId) as Row | undefined;
    return row ? toChat(row) : null;
  };
  const assertOwner = (chatId: number, userId: string) => {
    if (!getChat(chatId, userId)) throw new Error("Chat not found");
  };
  const getMessages = (chatId: number, userId: string) => {
    assertOwner(chatId, userId);
    return (db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC").all(chatId) as Row[]).map(toMessage);
  };
  const createChat = (title: string, userId: string, model: string, initialPrompt = title) => {
    const now = Date.now();
    const result = db.prepare(`INSERT INTO chats (title, user_id, model, initial_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(title, userId, model, initialPrompt, now, now);
    return getChat(Number(result.lastInsertRowid), userId)!;
  };
  const getChats = (userId: string, search = "") => {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    return (db.prepare(`SELECT * FROM chats WHERE user_id = ? AND (
      title LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM messages WHERE messages.chat_id = chats.id AND content LIKE ? ESCAPE '\\'
      )) ORDER BY is_pinned DESC, updated_at DESC, id DESC`).all(userId, pattern, pattern) as Row[]).map(toChat);
  };
  const updateChat = (chatId: number, userId: string, changes: { title?: string; isPinned?: boolean }) => {
    const chat = getChat(chatId, userId);
    if (!chat) return null;
    db.prepare("UPDATE chats SET title = ?, is_pinned = ? WHERE id = ? AND user_id = ?")
      .run(changes.title ?? chat.title, Number(changes.isPinned ?? chat.isPinned), chatId, userId);
    return getChat(chatId, userId);
  };
  const deleteChat = db.transaction((chatId: number, userId: string) => {
    if (!getChat(chatId, userId)) return false;
    db.prepare("DELETE FROM messages WHERE chat_id = ?").run(chatId);
    db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(chatId, userId);
    return true;
  });
  const appendUserMessage = db.transaction((chatId: number, userId: string, content: string, clientId: string) => {
    assertOwner(chatId, userId);
    const existing = db.prepare("SELECT * FROM messages WHERE chat_id = ? AND client_id = ?").get(chatId, clientId) as Row | undefined;
    if (existing) {
      if (existing.role !== "user" || existing.content !== content) throw new Error("Message ID conflict");
      return toMessage(existing);
    }
    const result = db.prepare("INSERT INTO messages (chat_id, role, content, client_id) VALUES (?, 'user', ?, ?)")
      .run(chatId, content, clientId);
    db.prepare("UPDATE chats SET updated_at = ? WHERE id = ?").run(Date.now(), chatId);
    return toMessage(db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid) as Row);
  });
  const saveReply = db.transaction((chatId: number, userId: string, parentClientId: string, content: string, clientId: string) => {
    assertOwner(chatId, userId);
    const parent = db.prepare("SELECT * FROM messages WHERE chat_id = ? AND client_id = ? AND role = 'user'")
      .get(chatId, parentClientId) as Row | undefined;
    if (!parent) throw new Error("User message not found");
    // Replace an old branch only after a reply has been received.
    db.prepare("DELETE FROM messages WHERE chat_id = ? AND id > ?").run(chatId, parent.id);
    const result = db.prepare("INSERT INTO messages (chat_id, role, content, client_id) VALUES (?, 'assistant', ?, ?)")
      .run(chatId, content, clientId);
    db.prepare("UPDATE chats SET updated_at = ? WHERE id = ?").run(Date.now(), chatId);
    return toMessage(db.prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid) as Row);
  });
  return { createChat, getChat, getChats, updateChat, deleteChat, getMessages, appendUserMessage, saveReply, close: () => db.close() };
}
