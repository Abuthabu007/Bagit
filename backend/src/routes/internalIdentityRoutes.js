import { Router } from "express";
import { requireInternalService } from "../internalServiceAuth.js";
import { getSessionCustomer } from "../services/authService.js";

export const internalIdentityRoutes = Router();

function getSessionToken(request) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("bagit_session="));

  if (!cookie) {
    return undefined;
  }

  try {
    return decodeURIComponent(cookie.slice("bagit_session=".length));
  } catch {
    return undefined;
  }
}

internalIdentityRoutes.get("/", requireInternalService, async (request, response) => {
  const session = await getSessionCustomer(getSessionToken(request));
  if (!session) {
    return response.status(401).json({ error: "Not signed in" });
  }
  return response.json({ customerId: session.customer.id });
});
