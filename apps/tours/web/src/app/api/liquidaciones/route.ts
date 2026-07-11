import { proxyJson } from "../_lib/proxy";

export async function POST(req: Request) {
  return proxyJson("/liquidaciones", "POST", await req.text());
}
