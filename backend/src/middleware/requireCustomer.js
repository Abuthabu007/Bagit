export async function requireCustomer(request, response, next) {
  try {
    const identityUrl = process.env.IDENTITY_SERVICE_URL ?? "http://identity:3000";
    const identityResponse = await fetch(`${identityUrl}/internal/session`, {
      headers: {
        cookie: request.headers.cookie ?? "",
        "X-Internal-Service-Token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (identityResponse.status === 401) {
      return response.status(401).json({ error: "Please sign in to access your orders" });
    }
    if (!identityResponse.ok) {
      console.error(`Identity service returned ${identityResponse.status} during session validation`);
      return response.status(503).json({ error: "Authentication service is temporarily unavailable" });
    }

    const session = await identityResponse.json();
    request.customer = { id: session.customerId };
    return next();
  } catch (error) {
    console.error("Could not validate customer session with identity service:", error);
    return response.status(503).json({ error: "Authentication service is temporarily unavailable" });
  }
}
