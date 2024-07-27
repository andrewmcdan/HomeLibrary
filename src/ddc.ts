// TODO: Dewey Decimal Classification
/*

This file should load /etc/ddcIndex.json and provide a function that takes a book object and returns the Dewey Decimal Classification for that book.
Make use of openai to assist in the classification process.

It should also provide a function to take a DDC number and return a JSON object with the classification details.

Need a function that takes in a new classification and updates the ddcIndex.json file.

*/


import fs from 'fs';
import AI from './ai.js';
import Logger from './logger.js';
import dotenv from 'dotenv';
dotenv.config();
import { Book } from './dBaseTypes.js';

const logger = new Logger(true, process.env.LOG_LEVEL);

const ddcIndex = JSON.parse(fs.readFileSync('etc/ddcIndex_updated.json', 'utf8'));

class DDC {
    static client: AI;
    constructor(){
        DDC.client = new AI();
    }

    async classifyBook_MainClass(book: Book){
        const classes = Object.keys(ddcIndex);
        console.log({classes});   
        const book1 = await DDC.client.classifyBook_Index(book, classes);
        return book1;
    }

    async classifyBook_SubClass(book: Book, mainClass: string){
        // find the mainClass in the index
        const classes = ddcIndex[mainClass];
        const book1 = await DDC.client.classifyBook_Index(book, classes);
        return book1;
    }

    /**
     * Get the classification details for a given Dewey Decimal Classification number
     * @param ddc The Dewey Decimal Classification number as a string
     * @returns A JSON object with the classification details
     */
    getClassificationDetails(ddc: string, index: any = ddcIndex, level: number = 0, concat: string = ''){
        return new Promise((resolve, reject) => {
            if(level > 5){
                reject('Classification not found');
            }
            // parse the string to get each level of classification
            const topLevel = ddc.substring(0, 1) + 'xx';
            const level2 = ddc.substring(0, 2) + 'x';
            const level3 = ddc.substring(0, 3);
            const level4 = ddc.substring(0, 5);
            const level5 = ddc;
            const levelsArr = [topLevel, level2, level3, level4, level5];
            // find the classification details
            for(const mainClass in index){
                if(index[mainClass]?.id === levelsArr[level]){
                    if(ddc == levelsArr[level]){
                        let returnObj:any = index[mainClass];
                        returnObj['FullDescription'] = (concat==''?'':concat + ':') + index[mainClass].description;
                        resolve(index[mainClass]);
                    }else{
                        resolve(this.getClassificationDetails(ddc, index[mainClass].subordinates, level + 1, (concat==''?'':concat + ':') + index[mainClass].description));
                    }
                }
            }
            reject('Classification not found');
        });
    }
}

export default DDC;