import client, { Connection, Channel } from "amqplib";
import { handle_login_req, handle_registration_req } from "../controller/handlers";
import { LOGIN_QUEUE_REQUEST, REGISTRATION_QUEUE_REQUEST, /* USER_INFO_QUEUE */ } from "../config/rabbit";
import { RabbitBindingKeysDTO } from "../dtos/RabbitBindingKeys.dto";
import { rmqPass, rmqUser, rmqhost } from "../config/rabbit";
import { OrderResponseDTO } from "../dtos/orderResponse.dto";


type HandlerCB = (msg: string, instance?: RabbitClient) => any;


class RabbitClient {
  bindKeys!: RabbitBindingKeysDTO;
  connection!: Connection;
  channel!: Channel;
  private connected!: Boolean;

  async connect() {
    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      console.log(`[AUTH SERVICE] Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect(
        `amqp://${rmqUser}:${rmqPass}@${rmqhost}:5672`
      );

      console.log(`[AUTH SERVICE] Rabbit MQ Connection is ready`);

      this.channel = await this.connection.createChannel();

      console.log(`[AUTH SERVICE] Created RabbitMQ Channel successfully`);
    } catch (error) {
      console.error(error);
      console.error(`[AUTH SERVICE]Not connected to MQ Server`);
    }
  }
  async setupExchange(exchange: string, exchangeType: string) {

    try {
      await this.channel.assertExchange(exchange, exchangeType, {
        durable: true,
      });
      console.log(`[AUTH SERVICE] Event Exchange '${exchange}' declared`);
    } catch (error) {
      console.error(`[AUTH SERVICE] Error setting up event exchange:`, error);
    }
  }
  async publishEvent(exchange: string, routingKey: string, message: OrderResponseDTO): Promise<boolean> {

    try {
      if (!this.channel) {
        await this.connect();
      }

      return this.channel.publish(
        exchange,
        routingKey, // No routing key needed for fanout
        Buffer.from(JSON.stringify(message)),
        {
          //TODO se necessario continuare a customizzare il channel
          appId: "AuthrService",
        }
      );
    } catch (error) {
      console.error("[AUTH SERVICE] Error publishing event:", error);
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
      console.error("[AUTH SERVICE]", error);
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
            return console.error(`[AUTH SERVICE] Invalid incoming message`);
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
  async requestBindingKeys(url: string): Promise<RabbitBindingKeysDTO> {
    console.log(`[AUTH SERVICE] Requesting binding keys from: ${url}`);
    const response = await fetch(url, { method: "GET" });
    return await response.json();
  }

}

export class RabbitSub extends RabbitClient {
  //----------------------CONSUME------------------------------
  async consumeLoginRequest() {
    console.log(`[AUTH SERVICE] Consuming login request with key: ${this.bindKeys.ConsumeLoginReq}`);
    await this.consume(LOGIN_QUEUE_REQUEST,
                       "OrderEventExchange",
                       this.bindKeys.ConsumeLoginReq,
                       (msg) => handle_login_req(msg)
                      );
  }

  async consumeRegistrationRequest() {
    console.log(`[AUTH SERVICE] Consuming registration request with key: ${this.bindKeys.ConsumeRegistrationReq}`);
    await this.consume(REGISTRATION_QUEUE_REQUEST,
                       "OrderEventExchange",
                       this.bindKeys.ConsumeRegistrationReq,
                       (msg) =>  handle_registration_req(msg)
                      );
  }

/*   async consumeUserInformationRequest() {
    console.log(`[AUTH SERVICE] Consuming user information request`);
    await this.consume(USER_INFO_QUEUE,"OrderEventExchange", this.bindKeys.ConsumeUserInformationReq, (msg) => console.log(msg));
  } */

}

export class RabbitPub extends RabbitClient {
  //----------------------SEND----------------------------------

  async sendLoginResp(message: any) {
    console.log(`[AUTH SERVICE] Sending login response with key: ${this.bindKeys.PublishLoginResp}`);
    await this.publishEvent("OrderEventExchange",
                            this.bindKeys.PublishLoginResp,
                            message
                           );
  }

  async sendRegistrationResp(message: any) {
    console.log(`[AUTH SERVICE] Sending registration response with key: ${this.bindKeys.PublishRegistrationReq}`);
    await this.publishEvent("OrderEventExchange",
                            this.bindKeys.PublishRegistrationReq,
                            message
                          );
  }

  /* async sendUserInformationResp(message: any) {
    await this.publishEvent("OrderEventExchange", this.bindKeys.PublishUserInformationResp, message);
  } */
}