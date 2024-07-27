// TODO: move all openai related code here
import Logger from './logger.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();
import { Book, User, Collection } from './dBaseTypes.js';

const logger = new Logger(true, process.env.LOG_LEVEL);


const exampleText1 = `The Dewey Decimal Classification for "Mastering Basic Cheesemaking" by Gianaclis Caldwell would be 641.36, which falls under the category of "Home Economics: Food and Drink: Dairy products, Cheesemaking."
Here is the breakdown of the classification in JSON format:
{
  "Main Category": "600 Technology",
  "Specific Subcategory": {
    "Subcategory Number": "640",
    "Subcategory Description": "Home economics"
  },
  "Specific Classification": {
    "Classification Number": "641.3",
    "Classification Description": "Food and drink"
  },
  "Further Specificity": {
    "Further Specific Classification Number": "641.36",
    "Further Specificity Description": "Dairy products, Cheesemaking"
  }
}`;

const exampleText2 = `Of the following dewey decimal classifications, which is most suitable for the book: `;
const exampleText3 = `Of the following dewey decimal classifications, which is most suitable for the book (if one is not suitable, suggest the appropriate classification): `;
const exampleText4 = `Please respond in JSON format. Example:
{
  "Classification": "xxxxx"
}`;

class AI {
    static client: OpenAI;
    constructor() {
        AI.client = new OpenAI();
    }

    async classifyBook_Open(book: Book) {
        const chatCompletion = await AI.client.chat.completions.create({
            messages: [{ role: 'user', content: 'how would you classify "' + book.title + '" by ' + book.authors[0] + ' using dewey decimal? can you provide a detailed breakdown of the classification with as much precision as possible and also in JSON format? for example ' + exampleText1 }],
            model: process.env.GPT_MODEL as string,
        });
        logger.log(chatCompletion.choices[0].message.content as string, 'info');

        // extract the JSON from the completion
        const mes = chatCompletion.choices[0].message.content as string;
        let classification = {} as any;
        try {
            classification = JSON.parse(mes.substring(mes.indexOf('{'), mes.lastIndexOf('}') + 1));
        } catch (e) {
            logger.log('Error parsing JSON from completion', 'error');
            logger.log('Error: ' + e, 'error');
        }
        // find the classification in the object
        book.classification = classification;
        // walk through the classification object and find the dewey decimal with the most specificity
        let dewey = '';
        for(const key in classification){
            for(const subkey in classification[key]){
                if(subkey.includes('Number')){
                    let newDewey = classification[key][subkey];
                    if(newDewey.length > dewey.length){
                        dewey = newDewey;
                    }
                }
            }
        }
        book.dewey_decimal = dewey;
        return book;
    }

    async classifyBook_Index(book: Book, classes: string[]) {
        const message = exampleText2 + book.title + ' by ' + book.authors.split(';').join(', ') + '\n\nOptions:\n\n' + classes.join('\n') + '\n\n' + exampleText4.replace('xxxxx', classes[0]);
        const chatCompletion = await AI.client.chat.completions.create({
            messages: [{ role: 'user', content: message }],
            model: process.env.GPT_MODEL as string,
        });
        logger.log(chatCompletion.choices[0].message.content as string, 'info');

        // extract the JSON from the completion
        const mes = chatCompletion.choices[0].message.content as string;
        let classification = {} as any;
        try {
            classification = JSON.parse(mes.substring(mes.indexOf('{'), mes.lastIndexOf('}') + 1));
        } catch (e) {
            logger.log('Error parsing JSON from completion', 'error');
            logger.log('Error: ' + e, 'error');
        }
        return classification;
    }

    async classifyBook_IndexSuggest(book: Book, classes: string[]) {
        const message = exampleText3 + book.title + ' by ' + book.authors.split(';').join(', ') + '\n\nOptions:\n\n' + classes.join('\n') + '\n\n' + exampleText4.replace('xxxxx', classes[0]);
        const chatCompletion = await AI.client.chat.completions.create({
            messages: [{ role: 'user', content: message }],
            model: process.env.GPT_MODEL as string,
        });
        logger.log(chatCompletion.choices[0].message.content as string, 'info');

        // extract the JSON from the completion
        const mes = chatCompletion.choices[0].message.content as string;
        let classification = {} as any;
        try {
            classification = JSON.parse(mes.substring(mes.indexOf('{'), mes.lastIndexOf('}') + 1));
        } catch (e) {
            logger.log('Error parsing JSON from completion', 'error');
            logger.log('Error: ' + e, 'error');
        }
        return classification;
    }
}

export default AI;