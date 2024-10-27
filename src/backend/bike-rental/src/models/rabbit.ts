import client, { Connection, Channel } from "amqplib";
import { handle_req_from_order_management, handle_cancel_request } from "../controller/handlers";

type HandlerCB = (msg: string, instance?: RabbitClient) => any;

const rmqUser = process.env.RABBITMQ_USER || "rileone"
const rmqPass = process.env.RABBITMQ_PASSWORD || "password"
const rmqhost = process.env.RABBITMQ_HOST || "rabbitmq"

const BIKE_SERVICE_ORDER_REQ_QUEUE = "bike_service_bike_request"

const BIKE_SERVICE_SAGA_REQ_QUEUE = "bike_service_saga_bike_request"

class RabbitClient {
  connection!: Connection;
  channel!: Channel;
  private connected!: Boolean;

  async connect() {
    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      console.log(`[BIKE SERVICE] Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect(
        `amqp://${rmqUser}:${rmqPass}@${rmqhost}:5672`
      );

      console.log(`[BIKE SERVICE] Rabbit MQ Connection is ready`);

      this.channel = await this.connection.createChannel();

      console.log(`[BIKE SERVICE] Created RabbitMQ Channel successfully`);
    } catch (error) {
      console.error(error);
      console.error(`[BIKE SERVICE]Not connected to MQ Server`);
    }
  }
  async setupExchange(exchange: string, exchangeType: string) {

    try {
      // Declare a fanout exchange
      await this.channel.assertExchange(exchange, exchangeType, {
        durable: true,
      });
      console.log(`[BIKE SERVICE] Event Exchange '${exchange}' declared`);
    } catch (error) {
      console.error(`[BIKE SERVICE] Error setting up event exchange:`, error);
    }
  }
  async publishEvent(exchange: string, routingKey: string, message: any): Promise<boolean> {

    try {
      if (!this.channel) {
        await this.connect();
      }

      return this.channel.publish(
        exchange,
        routingKey, // No routing key needed for fanout
        Buffer.from(message),
        {
          //TODO se necessario continuare a customizzare il channel
          appId: "BikerService",
        }
      );
    } catch (error) {
      console.error("[BIKE SERVICE] Error publishing event:", error);
      throw error;
    }
  }
  async sendToQueue(queue: string, message: any): Promise<boolean> {
    try {
      if (!this.channel) {
        await this.connect();
      }

      return this.channel.sendToQueue(queue, Buffer.from(message));
    } catch (error) {
      console.error("[BIKE SERVICE]", error);
      throw error;
    }

  }

  async createQueue(queue: string) {
    await this.channel.assertQueue(queue, {
      durable: true,
    });
  }
  async consume(queue: string, exchange: string, routingKey: string, handlerFunc: HandlerCB) {

    if (!this.channel) {
      await this.connect();
    }
    await this.channel.bindQueue(queue, exchange, routingKey);

    this.channel.consume(
      queue,
      (msg) => {
        {
          if (!msg) {
            return console.error(`Invalid incoming message`);
          }
          handlerFunc(msg?.content?.toString());
          this.channel.ack(msg);
        }
      },
      {
        noAck: false,
      }
    );
  }


}

class RabbitPublisher extends RabbitClient {
  constructor() {
    super();
  }
  //TODO aggiungere i vari meccanismi di retry and fallback in caso di errore
  //OrderExchange

  sendToOrderManagementMessageBroker = async (body: string): Promise<void> => {
    console.log(`[BIKE SERVICE] Sending to Order Management Service: ${body}`);
    const routingKey = "bike_main_listener";
    this.publishEvent("OrderEventExchange", routingKey, body);
  }
  sendToOrderManagementMessageBrokerSAGA = async (body: string): Promise<void> => {
    console.log(`[BIKE SERVICE] Sending to Order Management Service: ${body}`);
    const routingKey = "bike_saga_listener";
    this.publishEvent("OrderEventExchange", routingKey, body);
  }
}

class RabbitSubscriber extends RabbitClient {
  constructor() {
    super();
  }

  //---------------------------CONSUME--------------------------

  consumeBikeOrder = async () => {
    console.log("[BIKE SERVICE] Listening for bike orders...");
    const routingKey = "BDbike_request";
    this.consume(BIKE_SERVICE_ORDER_REQ_QUEUE, "OrderEventExchange", routingKey, (msg) => handle_req_from_order_management(msg));
  };

  consumecancelBikeOrder = async () => {
    console.log("[BIKE SERVICE] Listening for bike orders cancellation requests...");
    const routingKey = "BDbike_SAGA_request";
    this.consume(BIKE_SERVICE_SAGA_REQ_QUEUE, "OrderEventExchange", routingKey,(msg) => handle_cancel_request(msg));
  }
}

export {
  RabbitClient,
  RabbitPublisher,
  RabbitSubscriber
};