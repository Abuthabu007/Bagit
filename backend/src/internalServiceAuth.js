import { timingSafeEqual } from "node:crypto";

export function requireInternalService(request, response, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  const supplied = request.get("X-Internal-Service-Token") ?? "";

  if (!expected) {
    return response.status(503).json({ error: "Internal service authentication is not configured" });
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return response.status(401).json({ error: "Unauthorized service request" });
  }

  return next();
}
