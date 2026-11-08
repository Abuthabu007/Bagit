import express from "express";
import { productRoutes } from "./routes/productRoutes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
app.use("/api/products", productRoutes);

app.get("/healthz", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/readyz", (_request, response) => {
  response.status(200).json({ status: "ready" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});