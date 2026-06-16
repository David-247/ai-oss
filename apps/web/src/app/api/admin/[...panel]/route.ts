import { handleAdminAction, handleAdminGet } from "@/lib/admin-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ panel?: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { panel } = await context.params;
  return handleAdminGet(request, panel);
}

export async function POST(request: Request, context: RouteContext) {
  const { panel } = await context.params;
  return handleAdminAction(request, panel);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { panel } = await context.params;
  return handleAdminAction(request, panel);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { panel } = await context.params;
  return handleAdminAction(request, panel);
}
