import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createChatStore } from "../src/db/store";

test("existing SQLite files upgrade without losing chats, messages, or the initial prompt", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "deepseek-migration-"));
  const filename = path.join(directory, "legacy.sqlite");
  const legacy = new Database(filename);
  legacy.exec(`
    CREATE TABLE chats (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, title TEXT NOT NULL, model TEXT NOT NULL);
    CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER REFERENCES chats(id), role TEXT NOT NULL, content TEXT NOT NULL);
    INSERT INTO chats VALUES (1, 'alice', '原始问题', 'deepseek-v3');
    INSERT INTO messages VALUES (1, 1, 'user', '原始问题');
    INSERT INTO messages VALUES (2, 1, 'assistant', '原始回复');
  `);
  legacy.close();
  const store = createChatStore(filename);
  try {
    assert.equal(store.getChat(1, "alice")?.initialPrompt, "原始问题");
    assert.deepEqual(store.getMessages(1, "alice").map(message => message.content), ["原始问题", "原始回复"]);
    assert.equal(store.getMessages(1, "alice")[0].clientId, "stored-1");
    store.updateChat(1, "alice", { title: "新的名称", isPinned: true });
    assert.equal(store.getChat(1, "alice")?.initialPrompt, "原始问题");
    assert.equal(store.getChat(1, "alice")?.isPinned, true);
    assert.equal(store.deleteChat(1, "alice"), true);
    const raw = new Database(filename);
    try { assert.equal((raw.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n, 0); }
    finally { raw.close(); }
  } finally { store.close(); rmSync(filename); rmdirSync(directory); }
});

test("chat management and content search are scoped to the authenticated owner", () => {
  const store = createChatStore(":memory:");
  try {
    const first = store.createChat("第一段对话", "alice", "deepseek-flash");
    const second = store.createChat("第二段对话", "alice", "deepseek-flash");
    store.createChat("秘密对话", "bob", "deepseek-flash");
    store.appendUserMessage(first.id, "alice", "测试 SQLite 消息检索和 100% 完成", "user-1");
    assert.equal(store.getChats("alice", "SQLite")[0].id, first.id);
    assert.equal(store.getChats("alice", "%").length, 1);
    assert.equal(store.getChats("alice", "_").length, 0);
    assert.equal(store.getChats("bob", "SQLite").length, 0);
    store.updateChat(first.id, "alice", { isPinned: true });
    assert.equal(store.getChats("alice")[0].id, first.id);
    assert.equal(store.getChat(first.id, "bob"), null);
    assert.equal(store.updateChat(first.id, "bob", { title: "改名" }), null);
    assert.equal(store.deleteChat(first.id, "bob"), false);
    assert.throws(() => store.getMessages(first.id, "bob"));
    assert.throws(() => store.appendUserMessage(second.id, "bob", "冒充用户", "invalid"));
    assert.equal(store.getChats("alice").length, 2);
  } finally { store.close(); }
});

test("resending the same message is idempotent and regeneration replaces its branch atomically", () => {
  const store = createChatStore(":memory:");
  try {
    const chat = store.createChat("问题", "alice", "deepseek-flash");
    store.appendUserMessage(chat.id, "alice", "第一问", "q1");
    store.appendUserMessage(chat.id, "alice", "第一问", "q1");
    assert.equal(store.getMessages(chat.id, "alice").length, 1);
    assert.throws(() => store.appendUserMessage(chat.id, "alice", "不同内容", "q1"));
    store.saveReply(chat.id, "alice", "q1", "旧回复", "a1");
    store.appendUserMessage(chat.id, "alice", "第二问", "q2");
    store.saveReply(chat.id, "alice", "q2", "第二个回复", "a2");
    assert.throws(() => store.saveReply(chat.id, "alice", "missing", "无效回复", "a3"));
    assert.throws(() => store.saveReply(chat.id, "bob", "q1", "越权回复", "a3"));
    // An insert failure after removing the old branch must roll back the deletion.
    assert.throws(() => store.saveReply(chat.id, "alice", "q1", "ID 冲突", "q1"));
    assert.equal(store.getMessages(chat.id, "alice").length, 4);
    store.saveReply(chat.id, "alice", "q1", "新的回复", "a3");
    assert.deepEqual(store.getMessages(chat.id, "alice").map(message => [message.clientId, message.content]), [["q1", "第一问"], ["a3", "新的回复"]]);
  } finally { store.close(); }
});
