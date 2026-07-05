import { proxyJson } from "../_lib/proxy";

export async function POST(req: Request) {
  return proxyJson("/ventas", "POST", await req.text());
}