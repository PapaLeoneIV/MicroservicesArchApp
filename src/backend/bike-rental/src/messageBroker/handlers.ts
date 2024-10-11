import { RabbitMQConnection } from "./connection";
import { order as BikeDO } from "@prisma/client";
import { BikeOrderRepository, OrderDTO as BikeDTO } from "../api/service/OrderRepository/OrderRepository";
import { BikeStorageRepository } from "../api/service/StorageRepository/StorageRepository";
import { z } from 'zod';

let bike_info_schema = z.object({
  order_id: z.string(),
  road_bike_requested: z.number().refine((val) => val >= 0 && Number.isInteger(val)),
  dirt_bike_requested: z.number().refine((val) => val >= 0 && Number.isInteger(val)),
  renting_status: z.string(),
  created_at: z.string().transform((val) => new Date(val)),
  updated_at: z.string().transform((val) => new Date(val)),
});

export async function handle_req_from_order_management(rabbitmqClient: RabbitMQConnection, msg: string) {
  console.log(`[BIKE SERVICE] Received Request from order management:`, msg);
  let response_info: { id: string | null; status: string | null } = {
    id: null,
    status: null,
  };
  let order_info: BikeDTO;

  try {
    const data = JSON.parse(msg);
    const description = JSON.parse(data.description);
    order_info = bike_info_schema.parse(description);
  } catch (error) {
    console.error(`[BIKE SERVICE] Error while parsing message:`, error);
    await rabbitmqClient.sendToOrderManagementMessageBroker("ERROR");
    return;
  }

  const manager_db = new BikeOrderRepository();
  const storage_db = new BikeStorageRepository();

  if (await manager_db.check_existance(order_info.order_id)) {
    console.log("[BIKE SERVICE] Order already exists");
    await rabbitmqClient.sendToOrderManagementMessageBroker("ERROR");
    return;
  }
  console.log("[BIKE SERVICE] Order does not exist, creating order");
  let order: BikeDO = await manager_db.create_order(order_info);

  response_info.id = order_info.order_id;

  if (await storage_db.get_number_dirt_bikes() >= order.dirt_bike_requested
    && await storage_db.get_number_road_bikes() >= order.road_bike_requested) {
    console.log("[BIKE SERVICE] Order  with id : ", order.id, "APPROVED");
    storage_db.decrement_bike_count(order.road_bike_requested, order.dirt_bike_requested);
    order = await manager_db.update_status(order, "APPROVED");

    response_info.status = order.renting_status;

    rabbitmqClient.sendToOrderManagementMessageBroker(JSON.stringify(response_info));
    return;
  }
  console.log("[BIKE SERVICE] Order  with id : ", order.id, "REJECTED, there were not enough bikes");
  order = await manager_db.update_status(order, "DENIED");

  response_info.status = order.renting_status;

  rabbitmqClient.sendToOrderManagementMessageBroker(JSON.stringify(response_info));
  return;
}


export async function handle_cancel_request(rabbitmqClient: RabbitMQConnection, order_id: string) {
  const manager_db = new BikeOrderRepository();
  const storage_db = new BikeStorageRepository();

  if (await manager_db.check_existance(order_id)) {
    const order = await manager_db.get_order_info(order_id)!;
    if (order && order.renting_status === "APPROVED") {
      storage_db.increment_bike_count(order.road_bike_requested, order.dirt_bike_requested);
      const updatedOrder = await manager_db.update_status(order, "CANCELLED");

      const response_info = {
        id: order_id,
        status: updatedOrder.renting_status
      }
      rabbitmqClient.sendToOrderManagementMessageBroker(JSON.stringify(response_info));
      console.log("[BIKE SERVICE] Order with id: ", order_id, "has been cancelled");
    }
    else {
      console.log("[BIKE SERVICE] Order with id: ", order_id, "is not approved, cannot cancel");
    }
  } else {
    console.log("[BIKE SERVICE] Order with id: ", order_id, "does not exist");
  }
}

