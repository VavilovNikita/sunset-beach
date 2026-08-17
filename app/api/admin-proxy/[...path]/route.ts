import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// Same-origin stand-in for sunset, used by Client Components that need an
// authenticated request (rooms/pricing/availability/bookings/users writes
// and reads — see lib/backend.ts's ADMIN_API_URL for why). Reads the
// httpOnly session cookie server-side and forwards it as `Authorization:
// Bearer <token>`, since browser JS can't read that cookie to do this
// itself.
async function proxy(req: Request, path: string[]) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingUrl = new URL(req.url);
  const target = `${BACKEND_URL}/${path.join("/")}${incomingUrl.search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      // Let fetch() set its own multipart Content-Type (with boundary) when
      // handed a FormData body — copying the incoming header would carry
      // over the wrong boundary.
      init.body = await req.formData();
    } else {
      const text = await req.text();
      if (text) {
        init.body = text;
        if (contentType) headers.set("Content-Type", contentType);
      }
    }
  }

  const res = await fetch(target, init);
  const body = await res.arrayBuffer();
  const outHeaders = new Headers({ "Content-Type": res.headers.get("content-type") ?? "application/json" });
  const disposition = res.headers.get("content-disposition");
  if (disposition) outHeaders.set("Content-Disposition", disposition);

  return new NextResponse(body, { status: res.status, headers: outHeaders });
}

type RouteContext = { params: { path: string[] } };

export async function GET(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}

export async function POST(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}

export async function PUT(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}

export async function DELETE(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}
