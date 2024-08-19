import { Router } from "express";
import { MongoError } from "mongodb";

import { openMongoDBConn } from "../../../infra/mongo";
import { UserModel } from "../../../model/UserModel";
import { verifyToken } from "../../../utils/auth";

const DUPLICATED_KEY_ERROR_CODE = 11000;

export function auth(): Router {
  const router = Router();

  router.post("/signup", async (req, res) => {
    try {
      await openMongoDBConn();

      const reqBody = req.body;

      if (!reqBody.email) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      const entry = new UserModel({
        name: reqBody.name,
        surname: reqBody.surname,
        email: reqBody?.email,
        passwordHash: null,
        accessToken: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }); 

      await entry.hashPassword(reqBody.password);

      entry.createAccessToken();

      const document = await entry.save();

      return res.status(201).json({
        id: document._id,
        email: document.email,
        accessToken: document.accessToken,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      });
    } catch (err) {
      // FIXME: This is exposing internal error which is not good for security
      if ((err as MongoError)?.code === DUPLICATED_KEY_ERROR_CODE) {
        return res.status(400).json({ message: (err as MongoError)?.message });
      }

      return res.status(500).json({ message: (err as Error).message });
    }
  });

  router.post("/signin", async (req, res, next) => {
    try {
      await openMongoDBConn();
      const reqBody = req.body;

      const user = await UserModel.findOne({ email: reqBody.email }).exec();

      if (user) {
        const validate = await user.verifyPassword(reqBody.password)
        if (validate) {
          return res.status(201).json({
            accessToken: user.accessToken,
          });
        }
        res.status(400).json({ message: "Invalid Credentials" });
      }
      res.status(400).json({ message: "Invalid Credentials" });
      return;
    } catch (err) {
      res.status(400).json({ message: "Invalid Credentials" });
    }
  });

  router.get("/me", async (req, res, next) => {
    try {
      const user = await verifyToken(req);
      return res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ message: "Unauthorize" });
    }
  });

  return router;
}
