import { proxyJson } from "../../../_lib/proxy";

export async function PUT(req: Request) {
  return proxyJson("/usuarios/me/password", "PUT", await req.text());
}