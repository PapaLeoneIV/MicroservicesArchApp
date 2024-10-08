import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.metadata(),
        winston.format.json()
    ),
    transports: [   
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: 'logs.log' }),
        new winston.transports.File({ filename: 'error.log', level: 'error' })
    ]
});

export { logger };