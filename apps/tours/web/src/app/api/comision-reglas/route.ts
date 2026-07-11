import { proxyJson } from "../_lib/proxy";

export async function GET() {
  return proxyJson("/comision-reglas", "GET");
}

export async function POST(req: Request) {
  return proxyJson("/comision-reglas", "POST", await req.text());
}
