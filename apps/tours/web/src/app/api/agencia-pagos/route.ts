import { proxyJson } from "../_lib/proxy";

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return proxyJson(`/agencia-pagos${search}`, "GET");
}

export async function POST(req: Request) {
  return proxyJson("/agencia-pagos", "POST", await req.text());
}
