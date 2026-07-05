import { proxyJson } from "../_lib/proxy";

export async function GET() {
  return proxyJson("/usuarios", "GET");
}

export async function POST(req: Request) {
  return proxyJson("/usuarios", "POST", await req.text());
}