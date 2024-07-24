import Logger from './logger.js';
import isbn from 'node-isbn';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Book, User, Collection } from './dBaseTypes.js';
dotenv.config();

import dataBase from './database.js';

const logger = new Logger(true, 'silly');

let bookOut: any = null;
interface UUID {
    value: string;
}
isbn.resolve('978-1886439399').then(function (book: any) {
    console.log('Book found:');
    
    console.log(JSON.stringify(book, null, 2));
    bookOut = book;
}).catch(function (err: any) {
    console.log('Book not found', err);
});

const client = new OpenAI({
});

const exampleText = `The Dewey Decimal Classification for "The Analects of Confucius" by Confucius would be 181.112, which falls under the category of "Philosophy of the East."

Here is the breakdown of the classification in JSON format:

{
  "Main Category": "100 Philosophy and psychology",
  "Specific Subcategory": {
    "Subcategory Number": "181",
    "Subcategory Description": "Eastern philosophy"
  },
  "Specific Classification": {
    "Classification Number": "181.112",
    "Classification Description": "Confucianism"
  }
}`;

async function main() {
    while (bookOut === null) {
        await waitSeconds(1);
    }
    const chatCompletion = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'how would you classify "'+ bookOut.title +'" by '+ bookOut.authors[0] +' using dewery decimal? can you provide a detailed breakdown of the classification with as much precision as possible and also in JSON format? for example ' + exampleText }],
        model: 'gpt-3.5-turbo',
    });
    console.log(chatCompletion.choices[0].message.content);

    // extract the JSON from the completion
    const mes = chatCompletion.choices[0].message.content as string;
    const classification = JSON.parse(mes.substring(mes.indexOf('{'), mes.lastIndexOf('}') + 1));
    // find the classification in the object
    bookOut.classification = classification['Specific Classification']['Classification_Description'];
    bookOut.isbn = '978-1886439399';
    logger.log('creating user', 'info');
    await dataBase.DBInit();
    const newUser = new User('Andrew', 'andrewmcdan@gmail.com', 'd479');
    let userUUID: UUID;
    let newCollection: Collection;
    let collection_id: UUID;
    dataBase.Users_table.insert(newUser).then((res) => {
        console.log('User inserted into database');
        return dataBase.Users_table.search_username('Andrew');
    }).then((res:any) => {
        userUUID = { value: res.rows[0].id };
        return dataBase.Collections_table.insert(newCollection);
    }).then(() => {
        return dataBase.Collections_table.search_name('Andrews Collection');
    }).then((res:any) => {
        collection_id = { value: res.rows[0].id };
        const newBook = new Book(bookOut.isbn, bookOut.title, bookOut.authors.join(', '), '181.112', JSON.stringify(bookOut.classification), userUUID, collection_id, classification);
        return dataBase.Books_table.insert(newBook);
    }).then(() => {
        logger.log('All data inserted into database', 'info');
    }).catch((err:any) => {
        logger.log('Error inserting data into database', 'error');
        logger.log(err, 'error');
    }).finally(async() => {
        await dataBase.DBEnd();
    });
}

main();

async function waitSeconds (seconds: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}


