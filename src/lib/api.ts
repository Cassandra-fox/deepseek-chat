export async function post<T>(url: string, body: object = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "请求失败，请稍后再试。");
  return data as T;
}

export async function streamFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "请求失败，请检查网络后重试。");
  }
  return response;
}
