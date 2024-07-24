import winston from 'winston';
import dotenv from 'dotenv';
dotenv.config();
import chalk from 'chalk';

const { combine, timestamp, label, printf } = winston.format;

const myFormat = printf(({ level, message }) => {
    let timestamp = new Date().toISOString();
    if (level === 'error') {
        return chalk.red(`${timestamp} ${level}: ${message}`);
    }
    if (level === 'warn') {
        return chalk.yellow(`${timestamp} ${level}: ${message}`);
    }
    if (level === 'info') {
        return chalk.blue(`${timestamp} ${level}: ${message}`);
    }
    if (level === 'verbose') {
        return chalk.green(`${timestamp} ${level}: ${message}`);
    }
    if (level === 'debug') {
        return chalk.cyan(`${timestamp} ${level}: ${message}`);
    }
    if (level === 'silly') {
        return chalk.magenta(`${timestamp} ${level}: ${message}`);
    } else {
        return `${timestamp} ${level}: ${message}`;
    }
});

class Logger {
    con: boolean;
    static winston: any;
    static initdone: boolean = false;
    constructor(con = true, level = 'info') {
        this.con = con;
        if (!Logger.initdone) {
            Logger.winston = winston.createLogger({
                level: level,
                format: winston.format.json(),
                defaultMeta: { service: 'user-service' },
                transports: [
                    new winston.transports.File({ filename: 'error.log', level: 'error' }),
                    new winston.transports.File({ filename: 'combined.log' }),
                ],
            });
            if (con && process.env.NODE_ENV !== 'production') {
                Logger.winston.add(new winston.transports.Console({
                    format: myFormat,
                }));
            }
            Logger.initdone = true;
        }
    }

    log(message: string, level: string = 'info') {
        // use throw new Error() to get the stack trace
        let lineNumberInfo = '';
        try {
            throw new Error();
        } catch (e: any) {
            const stack = e.stack;
            const stackArr = stack.split('\n');
            // find the second line that contains the word 'at'
            let i = 0;
            while (i < stackArr.length && !stackArr[i].includes('at')) {
                i++;
            }
            i++;
            if (i < stackArr.length) {
                lineNumberInfo = stackArr[i];
            }
            if (lineNumberInfo.indexOf('/') !== -1) {
                lineNumberInfo = lineNumberInfo.substring(lineNumberInfo.lastIndexOf('/') + 1);
            } else if (lineNumberInfo.indexOf('\\') !== -1) {
                lineNumberInfo = lineNumberInfo.substring(lineNumberInfo.lastIndexOf('\\') + 1);
            }
            lineNumberInfo = lineNumberInfo.substring(0, lineNumberInfo.indexOf(')'));
        }
        message = lineNumberInfo + ' - ' + message;
        Logger.winston.log({
            level: level,
            message: message
        });
    }
}
export default Logger;