import { proxyJson } from "../_lib/proxy";

export async function GET() {
  return proxyJson("/agencia-precios", "GET");
}

export async function POST(req: Request) {
  return proxyJson("/agencia-precios", "POST", await req.text());
}
