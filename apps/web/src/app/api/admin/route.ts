import { handleAdminAction, handleAdminGet } from "@/lib/admin-server";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handleAdminGet(request);
}

export function POST(request: Request) {
  return handleAdminAction(request);
}

export function PATCH(request: Request) {
  return handleAdminAction(request);
}

export function DELETE(request: Request) {
  return handleAdminAction(request);
}
