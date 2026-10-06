import { Router, type IRouter } from "express";
import advancedRouter from "./advanced";
import healthRouter from "./health";
import authRouter from "./auth";
import bookingsRouter from "./bookings";
import settingsRouter from "./settings";
import clientsRouter from "./clients";
import employeesRouter from "./employees";
import portalRouter from "./portal";
import backupRouter from "./backup";
import mobileRouter from "./mobile";
import staffPreferencesRouter from "./staffPreferences";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/bookings", bookingsRouter);
router.use("/settings", settingsRouter);
router.use("/clients", clientsRouter);
router.use("/employees", employeesRouter);
router.use("/portal", portalRouter);
router.use("/backup", backupRouter);
router.use("/mobile", mobileRouter);
router.use("/settings/staff-preferences", staffPreferencesRouter);
router.use("/workspace", workspaceRouter);
router.use("/advanced", advancedRouter);

export default router;
