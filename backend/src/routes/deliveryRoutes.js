import { Router } from "express";

export const deliveryRoutes = Router();
const serviceablePincodes = new Set([
  "110001",
  "110016",
  "400001",
  "400051",
  "411001",
  "500001",
  "560001",
  "560034",
  "600001",
  "600062",
  "700001",
]);

deliveryRoutes.get("/serviceability/:pincode", (request, response) => {
  const { pincode } = request.params;
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return response.status(400).json({ error: "Enter a valid 6-digit Indian PIN code" });
  }

  const serviceable = serviceablePincodes.has(pincode);
  return response.json({
    serviceable,
    message: serviceable
      ? "Delivery is available in this demo PIN code"
      : "Delivery is not available in this demo PIN code yet",
  });
});
