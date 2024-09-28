import { Request, Response } from "express";
import { logger } from "../../../../logger/logger";
import { z } from "zod";
import axios from "axios";
import { check_bikes_availability } from "../service/bikeService";
import { parse } from "dotenv";

const URL_order_management = "http://localhost:3003/order/bike_update";

const order_schema = z.object({
  road: z.string(),
  dirt: z.string(),
});

interface BikeRequested {
  road: string;
  dirt: string;
}
let bike_requested: BikeRequested;

export const receive_order = async (
  req: Request,
  res: Response
): Promise<void> => {
  //PARSE DATA
  let parsedBody: any;
  try {
    parsedBody = order_schema.parse(req.body.bikes);
  } catch (error) {
    res.status(400).json({ error: "Bad Request" });
    logger.info("Error parsing data: request body not valid!", error);
    return;
  }
  try {
    console.log("Data received:", parsedBody);
    bike_requested = {
      road: parsedBody.road,
      dirt: parsedBody.dirt,
    };
    const db_response = await check_bikes_availability(bike_requested);
    //RESPOND TO Order Management
    if (db_response) {
      res.send("BIKEAPPROVED");
    } else {
      res.send("BIKEDENIED");
    }
  } catch (error) {
    logger.error("Error parsing data: request body not valid!", error);
    res.status(400).json({ error: "Bad Request" });
    return;
  }
};
