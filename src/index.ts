import 'source-map-support/register.js';
import Logger from './logger.js';
import isbn from 'node-isbn';
import dotenv from 'dotenv';
dotenv.config();
import { Book, User, Collection } from './dBaseTypes.js';
import dataBase from './database.js';
import AI from './ai.js';
import axios from 'axios';
import fs from 'fs';
import ddc from './ddc.js';

const logger = new Logger(true, 'silly');
const dewey = new ddc();

let bookOut: Book = new Book('', '', '', '', '', { value: '' }, { value: '' }, {});
let bookValid: boolean = false;
interface UUID {
    value: string;
}
isbn.resolve('978-0865718180').then(function (book: any) {
    logger.log('Book found:');
    logger.log(JSON.stringify(book, null, 2));
    bookOut.authors = book.authors.join(';');
    bookOut.isbn = "978-0865718180";
    bookOut.extra_info = book;
    bookOut.title = book.title;
    if(book.imageLinks?.thumbnail){
        bookOut.thumbnail = book.imageLinks.thumbnail.replace('-S.jpg', '.jpg');
    }
    // download the thumbnail
    axios({
        method: 'get',
        url: bookOut.thumbnail,
        responseType: 'stream'
    }).then(function (response: any) {
        // get the working directory
        let path = process.cwd();
        if(!path.includes('js_output')){
            path += '/js_output';
        }
        path = path + '/thumbs/thumbnail-'+ bookOut.thumbnail_url.substring(bookOut.thumbnail_url.lastIndexOf('/') + 1)
        response.data.pipe(fs.createWriteStream(path, { flags: 'w' }));
        bookOut.thumbnail = path;
        logger.log(JSON.stringify({bookOut}, null,2));
        bookValid = true;
    });
    logger.log('Book out:');
    logger.log(JSON.stringify(bookOut, null, 2));
}).catch(function (err: any) {
    logger.log('Book not found', err);
});

const client = new AI();

async function main() {
    while(!bookValid) {
        await waitSeconds(1);
    }
    const book1 = await client.classifyBook_Open(bookOut);

    logger.log('creating user', 'info');
    await dataBase.DBInit();
    const newUser = new User('Andrew', 'andrewmcdan@gmail.com', 'd479');
    let userUUID: UUID;
    let newCollection: Collection;
    let collection_id: UUID;
    dataBase.Users_table.insert(newUser).then((res:any) => {
        if(res.success === true)
            logger.log('User inserted into database', 'info');
        else if(res.success === false && res.error === 'User already exists')
            logger.log('User already exists in database', 'info');
        else
            logger.log('Error inserting user into database: ' + res.error, 'error');
        return dataBase.Users_table.search_username('Andrew');
    }).then((res:any) => {
        userUUID = { value: res.rows[0].id };
        newCollection = new Collection('Andrews Collection', userUUID, 'A collection of books that I own', {'test': 'this is a test collection', 'test2': ['val1', 'val2']});
        return dataBase.Collections_table.insert(newCollection);
    }).then((res:any) => {
        if(res.success === true)
            logger.log('Collection inserted into database', 'info');
        else if(res.success === false && res.error === 'Collection already exists')
            logger.log('Collection already exists in database', 'info');
        else
            logger.log('Error inserting collection into database: ' + res.error, 'error');
        return dataBase.Collections_table.search_name('Andrews Collection');
    }).then((res:any) => {
        collection_id = { value: res.rows[0].id };
        const newBook = new Book(book1.isbn, book1.title, book1.authors, book1.dewey_decimal, JSON.stringify(book1.classification), userUUID, collection_id, book1);
        newBook.thumbnail_local = bookOut.thumbnail_local;
        newBook.thumbnail_url = bookOut.thumbnail_url;
        return dataBase.Books_table.insert(newBook);
    }).then((res:any) => {
        if(res.success === true)
            logger.log('Book inserted into database', 'info');
        else if(res.success === false && res.error === 'ISBN already exists')
            logger.log('Book already exists in database', 'info');
        else
            logger.log('Error inserting book into database: ' + res.error, 'error');
    }).catch((err:any) => {
        logger.log('Error inserting data into database', 'error');
        logger.log(err, 'error');
    }).finally(async() => {
        logger.log('All database operations complete. Closing database.', 'info');
        await dataBase.DBEnd();
    });
    dewey.getClassificationDetails("6xx").then((dewey:any) => {
        logger.log(JSON.stringify({"id":1, dewey}, null,2).substring(0,500));
    }).catch((err:any) => {
        logger.log(err);
    });
    dewey.getClassificationDetails("64x").then((dewey:any) => {
        logger.log(JSON.stringify({"id":2, dewey}, null,2).substring(0,500));
    }).catch((err:any) => {
        logger.log(err);
    });
    dewey.getClassificationDetails("641").then((dewey:any) => {
        logger.log(JSON.stringify({"id":3, dewey}, null,2).substring(0,500));
    }).catch((err:any) => {
        logger.log(err);
    });
    dewey.getClassificationDetails("641.2").then((dewey:any) => {
        logger.log(JSON.stringify({"id":4, dewey}, null,2).substring(0,500));
    }).catch((err:any) => {
        logger.log(err);
    });
    // dewey.getClassificationDetails("641.25").then((dewey:any) => {
    //     logger.log({"id":5, dewey});
    // }).catch((err:any) => {
    //     logger.log(err);
    // });
    dewey.updateIndex("641.25", "Carbonated Drinks").then((res:any) => {
        logger.log(JSON.stringify({"id":7, res}, null,2));
        dewey.getClassificationDetails("641.25").then((dewey:any) => {
            logger.log(JSON.stringify({"id":6, dewey}, null,2));
        }).catch((err:any) => {
            logger.log(err);
        });
    }).catch((err:any) => {
        logger.log(err);
    });
}

main();

async function waitSeconds (seconds: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}


