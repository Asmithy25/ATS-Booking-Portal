import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import bookingsRouter from "./bookings";
import settingsRouter from "./settings";
import clientsRouter from "./clients";
import employeesRouter from "./employees";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/bookings", bookingsRouter);
router.use("/settings", settingsRouter);
router.use("/clients", clientsRouter);
router.use("/employees", employeesRouter);

export default router;
