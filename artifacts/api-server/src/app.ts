import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { eq } from "drizzle-orm";
import { db, clientAccountsTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { extractClientSession } from "./middleware/auth";
import { repairClientData } from "./lib/client-data-repair";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Repair legacy/imported client relationships before client-facing booking,
// wellness, feedback, and portal requests are served. This makes the repair
// automatic for existing data and keeps newly-created client bookings linked.
app.use(async (req, _res, next) => {
  const clientSession = extractClientSession(req);
  const clientRoute = req.path.startsWith("/api/portal/client") || req.path.startsWith("/api/bookings");
  if (!clientSession || !clientRoute) {
    next();
    return;
  }

  try {
    const clientId = Number(clientSession.id);
    if (Number.isInteger(clientId) && clientId > 0) {
      const [client] = await db
        .select({ id: clientAccountsTable.id, phone: clientAccountsTable.phone })
        .from(clientAccountsTable)
        .where(eq(clientAccountsTable.id, clientId))
        .limit(1);
      if (client) await repairClientData(client.id, client.phone);
    }
  } catch (err) {
    req.log.warn({ err }, "Client relationship repair skipped");
  }

  next();
});

app.use("/api", router);

export default app;
