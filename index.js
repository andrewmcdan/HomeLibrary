const isbn = require('node-isbn');
const ai = require('openai');


isbn.resolve('1398820601').then(function (book) {
        console.log('Book found:' );
        console.log(JSON.stringify(book, null, 2));
    }).catch(function (err) {
        console.log('Book not found', err);
    });

ai.configure({
    apiKey: 'your-api-key',
});

