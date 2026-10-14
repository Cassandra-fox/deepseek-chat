export const models = [
  { id: "deepseek-flash", name: "DeepSeek Flash", description: "日常问答与创作" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", description: "复杂问题与深入推理" },
] as const;

export function normalizeModel(model: unknown) {
  return model === "deepseek-r1" || model === "deepseek-reasoner" || model === "deepseek-v4-pro"
    ? "deepseek-v4-pro" : "deepseek-flash";
}
