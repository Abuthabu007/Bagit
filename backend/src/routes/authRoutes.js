import { Router } from "express";
import {
  completeSignup,
  destroySession,
  getSessionCustomer,
  loginWithPassword,
  requestLoginOtp,
  requestSignupOtp,
  setFirstPassword,
  skipFirstPassword,
  verifySignupOtp,
  verifyLoginOtp,
} from "../services/authService.js";

export const authRoutes = Router();

function sendResult(response, result) {
  const { status, sessionToken, ...body } = result;
  if (sessionToken) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.setHeader(
      "Set-Cookie",
      `bagit_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`,
    );
  }
  return response.status(status).json(body);
}

function getSessionToken(request) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("bagit_session="));
  return cookie ? decodeURIComponent(cookie.slice("bagit_session=".length)) : undefined;
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `bagit_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
  );
}

authRoutes.post("/signup/otp", async (request, response) => {
  return sendResult(response, await requestSignupOtp(request.body?.phone));
});

authRoutes.post("/signup/verify", async (request, response) => {
  return sendResult(
    response,
    await verifySignupOtp(request.body?.challengeId, request.body?.code),
  );
});

authRoutes.post("/signup/complete", async (request, response) => {
  return sendResult(response, await completeSignup(request.body ?? {}));
});

authRoutes.post("/login/otp", async (request, response) => {
  return sendResult(response, await requestLoginOtp(request.body?.phone));
});

authRoutes.post("/login/otp/verify", async (request, response) => {
  return sendResult(
    response,
    await verifyLoginOtp(request.body?.challengeId, request.body?.code),
  );
});

authRoutes.post("/login/password", async (request, response) => {
  return sendResult(
    response,
    await loginWithPassword(request.body?.phone, request.body?.password),
  );
});

authRoutes.post("/password/setup", async (request, response) => {
  return sendResult(
    response,
    await setFirstPassword(getSessionToken(request), request.body?.password),
  );
});

authRoutes.post("/password/setup/skip", async (request, response) => {
  const result = await skipFirstPassword(getSessionToken(request));
  if (result.status === 204) {
    return response.status(204).end();
  }
  return sendResult(response, result);
});

authRoutes.get("/me", async (request, response) => {
  const session = await getSessionCustomer(getSessionToken(request));
  if (!session) {
    return response.status(401).json({ error: "Not signed in" });
  }
  return response.json(session);
});

authRoutes.post("/logout", async (request, response) => {
  await destroySession(getSessionToken(request));
  clearSessionCookie(response);
  return response.status(204).end();
});
