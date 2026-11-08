import { getSessionCustomer } from "../services/authService.js";

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

export async function requireCustomer(request, response, next) {
  try {
    const session = await getSessionCustomer(getSessionToken(request));
    if (!session) {
      return response.status(401).json({ error: "Please sign in to access your orders" });
    }

    request.customer = session.customer;
    return next();
  } catch (error) {
    return next(error);
  }
}
