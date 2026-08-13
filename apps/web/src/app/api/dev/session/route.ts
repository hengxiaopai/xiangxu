import { devSessionRequestSchema, devSessionResponseSchema } from "@xiangxu/contracts";
import { NextResponse } from "next/server";

import {
  devSessionCookie,
  devSessionHandlers,
  isDevSessionEnabled,
  sessionExpiry,
} from "../../../../server/composition/runtime";
import { cookieValue, problem } from "../../../../server/http";

export async function POST(request: Request) {
  const instance = "/api/dev/session";
  if (!isDevSessionEnabled()) return unavailable(instance);
  try {
    devSessionRequestSchema.parse(await request.json());
    const established = await devSessionHandlers.establish("xiangxu-local-dev", sessionExpiry());
    const response = NextResponse.json(devSessionResponseSchema.parse({
      profile: "development",
      authenticated: true,
      cookie: { httpOnly: true, secureInProduction: true, sameSite: "lax" },
    }));
    response.cookies.set(devSessionCookie.name, established.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: devSessionCookie.maxAge,
      secure: false,
    });
    return response;
  } catch (error) {
    return problem(error, instance);
  }
}

export async function DELETE(request: Request) {
  const instance = "/api/dev/session";
  if (!isDevSessionEnabled()) return unavailable(instance);
  try {
    const token = cookieValue(request.headers.get("cookie"), devSessionCookie.name);
    if (token !== undefined) await devSessionHandlers.end(token);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(devSessionCookie.name, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: false });
    return response;
  } catch (error) {
    return problem(error, instance);
  }
}

function unavailable(instance: string) {
  return NextResponse.json({
    type: "https://xiangxu.local/problems/not-found",
    title: "Not Found",
    status: 404,
    code: "NOT_FOUND",
    correlationId: "00000000-0000-7000-8000-000000000000",
    instance,
  }, { status: 404, headers: { "Content-Type": "application/problem+json" } });
}
