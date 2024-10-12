import {rabbitmqClient} from "./connection";

export type INotification = {
  title: string;
  description: string;
};


export const sendNotification = async (notification: INotification, queue: string): Promise<boolean> => {
 
  let res = await rabbitmqClient.sendToQueue(queue, notification);

  console.log(`[BIKE SERVICE]Sent the notification to consumer`);
  return res;
};