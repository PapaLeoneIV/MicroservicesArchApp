import { PrismaClient } from '@prisma/client';
import { logger } from "../../../../logger/logger"
import { string } from 'zod';
const prisma = new PrismaClient();

interface hotelRequested {
    to: string;
    from: string;
}


export const check_hotel_availability = async (req: hotelRequested): Promise<boolean> => {

    return true;

}