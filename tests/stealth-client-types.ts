import {
  createStealthClient,
  type StealthAxiosInstance,
} from "../src/index.ts";

const client: StealthAxiosInstance = createStealthClient({ proxyUrl: null });

void client({ url: "https://example.com", proxyUrl: "http://proxy.test:8000" });
void client("https://example.com", {
  baseURL: "https://example.com/api",
  params: { page: 2 },
  proxyUrl: null,
});
void client.request({
  url: "https://example.com",
  params: { page: 2 },
  proxyUrl: "http://proxy.test:8000",
});
void client.get("https://example.com", { proxyUrl: null });
void client.options("https://example.com", { proxyUrl: null });
void client.post("https://example.com", { ok: true }, { proxyUrl: null });
void client.postForm(
  "https://example.com",
  { ok: true },
  { proxyUrl: "http://proxy.test:8000" },
);

client.defaults.proxyUrl = null;
