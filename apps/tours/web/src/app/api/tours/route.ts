import { proxyJson } from "../_lib/proxy";

export async function GET() {
  return proxyJson("/tours", "GET");
}

export async function POST(req: Request) {
  return proxyJson("/tours", "POST", await req.text());
}
