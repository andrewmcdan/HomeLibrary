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

let ddcIndex = JSON.parse(fs.readFileSync('etc/ddcIndex_updated.json', 'utf8'));

class DDC {
    static client: AI;
    constructor() {
        DDC.client = new AI();
    }

    async classifyBook_MainClass(book: Book) {
        const classes = Object.keys(ddcIndex);
        console.log({ classes });
        const book1 = await DDC.client.classifyBook_Index(book, classes);
        return book1;
    }

    async classifyBook_SubClass(book: Book, mainClass: string) {
        // find the mainClass in the index
        const classes = ddcIndex[mainClass];
        const book1 = await DDC.client.classifyBook_Index(book, classes);
        return book1;
    }

    /**
     * Get the classification details for a given Dewey Decimal Classification number
     * @param ddc The Dewey Decimal Classification number as a string. Examples: '641.36', '641.3', '641', '64x', '6xx'
     * @returns A JSON object with the classification details
     */
    getClassificationDetails(ddc: string, index: any = ddcIndex, level: number = 0, concat: string = '') {
        return new Promise((resolve, reject) => {
            if (level > 5) {
                reject('Classification not found');
            }
            // parse the string to get each level of classification
            const topLevel = ddc.substring(0, 1) + '00';
            const level2 = ddc.substring(0, 2) + '0';
            const level3 = ddc.substring(0, 3);
            const level4 = ddc.substring(0, 5);
            const level5 = ddc;
            const levelsArr = [topLevel, level2, level3, level4, level5];
            // find the classification details
            for (const mainClass of index) {
                if (mainClass?.number === levelsArr[level] || mainClass?.id === ddc) {
                    if (ddc == levelsArr[level] || mainClass?.id === ddc) {
                        let returnObj: any = mainClass
                        returnObj['FullDescription'] = (concat == '' ? '' : concat + ':') + mainClass.description;
                        resolve(mainClass);
                    } else {
                        resolve(this.getClassificationDetails(ddc, mainClass.subordinates, level + 1, (concat == '' ? '' : concat + ':') + mainClass.description));
                    }
                }
            }
            reject('Classification not found');
        });
    }

    /**
     * Update the ddcIndex.json file with a new classification
     * @param newClass_ddc The new classification to add to the index
     * @param newClass_descr The description of the new classification
     */
    updateIndex(newClass_ddc: string, newClass_descr: string) {
        logger.log('Adding new classification to index: ' + newClass_ddc + ' - ' + newClass_descr);
        return new Promise((resolve, reject) => {
            const topLevel = newClass_ddc.substring(0, 1) + '00';
            const level2 = newClass_ddc.substring(0, 2) + '0';
            const level3 = newClass_ddc.substring(0, 3);
            const level4 = newClass_ddc.substring(0, 5);
            const level5 = newClass_ddc.substring(0, 6);
            const level6 = newClass_ddc.substring(0, 7);
            const levelsArr = [topLevel, level2, level3, level4, level5, level6];

            // find the last pair in the array that match
            let ind = 0;
            for (let i = 0; i < levelsArr.length - 1; i++) {
                if (levelsArr[i] === levelsArr[i + 1]) {
                    ind = i;
                    break;
                }
            }

            this.getClassificationDetails(newClass_ddc).then((res: any) => {
                reject('Classification already exists in index');
            }).catch((err: any) => {
                if (err == 'Classification not found') {
                    const newClass = {
                        id: newClass_ddc,
                        number: newClass_ddc,
                        description: newClass_descr
                    };

                    const insertIntoIndex = (index: any = ddcIndex, level: number = 0): boolean => {
                        if (level > ind) {
                            return false;
                        }
                        let found = false;
                        for (let ddc of index) {
                            if (found) return true;
                            if (ddc.number === levelsArr[ind - 1]) {
                                if (ddc?.subordinates) {
                                    ddc.subordinates.push(newClass);
                                } else {
                                    ddc.subordinates = [newClass];
                                }
                                return true;
                            } else {
                                if (ddc?.subordinates) {
                                    found = insertIntoIndex(ddc.subordinates, level + 1);
                                }
                            }
                        }
                        return found;
                    }
                    if (insertIntoIndex()) {
                        this.saveIndex();
                        resolve('Classification added to index');
                    } else {
                        reject('Error adding classification to index. Unknown error from insertIntoIndex()');
                    }
                } else {
                    reject('Error adding classification to index. Unknown error from getClassificationDetails()');
                }
            });
        });
    }

    saveIndex() {
        fs.writeFileSync('etc/ddcIndex_updated.json', JSON.stringify(ddcIndex, null, 2));
    }
}

export default DDC;