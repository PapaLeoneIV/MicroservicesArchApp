const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

const QueueNames = {
  ORDER_REQ: "bike_service_bike_request",
  SAGA_REQ: "bike_service_saga_bike_request",
};

const EXCHANGE = "OrderEventExchange";

export { RABBITMQ_URL, QueueNames, EXCHANGE };
