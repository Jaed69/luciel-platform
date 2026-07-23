import { proxyJson } from "../_lib/proxy";

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return proxyJson(`/solicitudes${search}`, "GET");
}

export async function POST(req: Request) {
  return proxyJson("/solicitudes", "POST", await req.text());
}
