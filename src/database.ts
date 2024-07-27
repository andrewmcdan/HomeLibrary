import Logger from './logger.js';
import pg from "pg";
import fs from "fs";
const { Client } = pg;
import { Book, User, Collection } from './dBaseTypes.js';

interface UUID {
    value: string;
}

const logger = new Logger(true, 'silly');

const dbClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT as string),
});

class DBError extends Error {
    // static number of errors
    static count: number = 0;
    message: string;
    constructor(message: string) {
        if(
        message.includes('constraint "fk_collections_owner_id" for relation "collections" already exists') ||
        message.includes('constraint "fk_books_owner_id" for relation "books" already exists') ||
        message.includes('constraint "fk_books_collection_id" for relation "books" already exists') ||
        message.includes('constraint "fk_users_owner_id" for relation "users" already exists')
        ){
            super();
            this.message = "NOT AN ERROR";
            logger.log(`DBError (${DBError.count}): ${message}`, 'info');
            return;
        }
        DBError.count++;
        super();
        this.name = "DB_Error";
        this.message = message;
        logger.log(`DBError (${DBError.count}): ${message}`, 'error');
    }
}

const tableDefinitions: Record<string, any> = JSON.parse(fs.readFileSync('etc/db_definition.json', 'utf8'));

const waitSeconds = async (seconds: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

const DbQuery = (query: string) => {
    return new Promise((resolve, reject) => {
        dbClient.query(query, (err: any, res: any) => {
            if (err) {
                reject(new DBError(err.message));
            }
            resolve(res);
        });
    });
}

const DbQueryWithParams = (query: string, params: any[]) => {
    return new Promise((resolve, reject) => {
        dbClient.query(query, params, (err: any, res: any) => {
            if (err) {
                reject(new DBError(err.message));
            }
            resolve(res);
        });
    });
}

const DBInit = async () => {
    await dbClient.connect();

    // First thing to do i ensure that all tables exist, have the correct columns, indexes, and foreign keys

    let waiters = [];
    // create the uuid extension
    const createUUIDExtension = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    waiters.push(DbQuery(createUUIDExtension));
    waiters.push(DbQuery(`
        CREATE OR REPLACE FUNCTION generate_uuid() RETURNS UUID AS $$
        BEGIN
          RETURN uuid_generate_v4();
        END;
        $$ LANGUAGE plpgsql;
      `
    ));

    try {
        await Promise.all(waiters);
        logger.log('Tables, columns, indexes, and foreign keys checked and created if not exist.', 'info');
    } catch (err) {
        logger.log('Error creating tables, columns, indexes, or foreign keys', 'error');
    }

    waiters = [];
    
    // Iterate over each table definition
    for (const [tableName, tableDef] of Object.entries(tableDefinitions)) {
        // Construct the CREATE TABLE query
        const columns = Object.entries(tableDef.columns)
            .map(([colName, colType]) => `${colName} ${colType}`)
            .join(', ');
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns});`;
        waiters.push(DbQuery(createTableQuery));

        // Ensure all columns exist
        for (const colName of Object.keys(tableDef.columns)) {
            const alterTableQuery = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${tableDef.columns[colName]};`;
            waiters.push(DbQuery(alterTableQuery));
        }

        // Create indexes
        if (tableDef.indexes) {
            for (const index of tableDef.indexes) {
                const createIndexQuery = `CREATE INDEX IF NOT EXISTS ${tableName.toLowerCase()}_${index}_index ON ${tableName} (${index});`;
                waiters.push(DbQuery(createIndexQuery));
            }
        }

        // Add foreign keys
        if (tableDef.foreign_keys) {
            for (const [colName, refTable] of Object.entries(tableDef.foreign_keys)) {
                const addForeignKeyQuery = `
            ALTER TABLE ${tableName}
            ADD CONSTRAINT fk_${tableName.toLowerCase()}_${colName}
            FOREIGN KEY (${colName})
            REFERENCES ${refTable};
          `;
                waiters.push(DbQuery(addForeignKeyQuery));
            }
        }
    }


    try {
        await Promise.all(waiters);
        logger.log('Tables, columns, indexes, and foreign keys checked and created if not exist.', 'info');
    } catch (err) {
        if(err instanceof DBError && err.message === "NOT AN ERROR"){
            logger.log('Tables, columns, indexes, and foreign keys checked and created if not exist.', 'info');
        } else {
            logger.log('Error creating tables, columns, indexes, or foreign keys', 'error');
        }
    }
}



const Books_table = {
    insert: async (book: Book) => {
        let query = '';
        if (book.isbn.length === 13 || book.isbn.length === 14) {
            query = `INSERT INTO books (isbn13, title, authors, dewey_decimal, classification, owner_id, collection_id, extra_info, thumbnail_local, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
        } else {
            query = `INSERT INTO books (isbn9, title, authors, dewey_decimal, classification, owner_id, collection_id, extra_info, thumbnail_local, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
        }
        const values = [book.isbn, book.title, book.authors, book.dewey_decimal, JSON.stringify(book.classification), book.owner_id.value, book.collection_id.value, JSON.stringify(book.extra_info), book.thumbnail_local, book.thumbnail_url];
        // define retval as a type that has a success property, an error property, and a data property
        let retVal: { success: boolean, error: string, data: any } = { success: false, error: '', data: null };
        return new Promise((resolve, reject) => {
            DbQueryWithParams(query, values).then((res) => {
                retVal.data = res;
                retVal.success = true;
                resolve(retVal);
            }).catch((err) => {
                // parse the error to see if the error is of known type
                if (err.message.includes('duplicate key value violates unique constraint "books_isbn13_key"') || err.message.includes('duplicate key value violates unique constraint "books_isbn9_key"')) {
                    retVal.error = 'ISBN already exists';
                    retVal.success = false;
                    resolve(retVal);
                } else {
                    retVal.error = err.message;
                    retVal.success = false;
                    reject(retVal);
                }
            });
        });
    },
    search_isbn: async (isbn: string) => {
        const query = `SELECT * FROM books WHERE isbn = $1`;
        const values = [isbn];
        return DbQueryWithParams(query, values);
    },
    update: async (id: UUID, book: Book) => {
        const query = `UPDATE books SET title = $1, authors = $2, dewey_decimal = $3, classification = $4, owner_id = $5, collection_id = $6, extra_info = $7 WHERE id = $8`;
        const values = [book.title, book.authors, book.dewey_decimal, JSON.stringify(book.classification), book.owner_id.value, book.collection_id.value, JSON.stringify(book.extra_info), id.value];
        return DbQueryWithParams(query, values);
    },
    delete_isbn: async (isbn: string) => {
        const query = `DELETE FROM books WHERE isbn = $1`;
        const values = [isbn];
        return DbQueryWithParams(query, values);
    },
    delete_id: async (id: UUID) => {
        const query = `DELETE FROM books WHERE id = $1`;
        const values = [id.value];
        return DbQueryWithParams(query, values);
    }
    // TODO: search by title, author, dewey_decimal, classification, owner_id, collection_id, extra_info
    // TODO: delete by title, author, dewey_decimal, classification, owner_id, collection_id, extra_info
};



const Users_table = {
    insert: async (user: User) => {
        const query = `INSERT INTO users (username, email, password) VALUES ($1, $2, $3)`;
        const values = [user.username, user.email, user.password];
        let retVal: { success: boolean, error: string, data: any } = { success: false, error: '', data: null };
        return new Promise((resolve, reject) => {
            DbQueryWithParams(query, values).then((res) => {
                retVal.data = res;
                retVal.success = true;
                resolve(retVal);
            }).catch((err) => {
                if (err.message.includes('duplicate key value violates unique constraint "users_username_key"')) {
                    retVal.error = 'User already exists';
                    retVal.success = false;
                    resolve(retVal);
                } else {
                    retVal.error = err.message;
                    retVal.success = false;
                    reject(retVal);
                }
            });
        });
    },
    search_username: async (username: string) => {
        const query = `SELECT * FROM users WHERE username = $1`;
        const values = [username];
        return DbQueryWithParams(query, values);
    },
    search_email: async (email: string) => {
        const query = `SELECT * FROM users WHERE email = $1`;
        const values = [email];
        return DbQueryWithParams(query, values);
    },
    update: async (id: UUID, user: User) => {
        const query = `UPDATE users SET username = $1, email = $2, password = $3 WHERE id = $4`;
        const values = [user.username, user.email, user.password, id.value];
        return DbQueryWithParams(query, values);
    },
    delete_username: async (username: string) => {
        const query = `DELETE FROM users WHERE username = $1`;
        const values = [username];
        return DbQueryWithParams(query, values);
    },
    delete_email: async (email: string) => {
        const query = `DELETE FROM users WHERE email = $1`;
        const values = [email];
        return DbQueryWithParams(query, values);
    },
    delete_id: async (id: UUID) => {
        const query = `DELETE FROM users WHERE id = $1`;
        const values = [id.value];
        return DbQueryWithParams(query, values);
    }
};



const Collections_table = {
    insert: async (collection: Collection) => {
        const query = `INSERT INTO collections (name, owner_id, description, extra_info) VALUES ($1, $2, $3, $4)`;
        const values = [collection.name, collection.owner_id.value, collection.description, JSON.stringify(collection.extra_info)];
        let retVal: { success: boolean, error: string, data: any } = { success: false, error: '', data: null };
        return new Promise((resolve, reject) => {
            DbQueryWithParams(query, values).then((res) => {
                retVal.data = res;
                retVal.success = true;
                resolve(retVal);
            }).catch((err) => {
                if (err.message.includes('duplicate key value violates unique constraint "collections_name_key"')) {
                    retVal.error = 'Collection already exists';
                    retVal.success = false;
                    resolve(retVal);
                } else {
                    retVal.error = err.message;
                    retVal.success = false;
                    reject(retVal);
                }
            });
        });
    },
    search_name: async (name: string) => {
        const query = `SELECT * FROM collections WHERE name = $1`;
        const values = [name];
        return DbQueryWithParams(query, values);
    },
    update: async (id: UUID, collection: Collection) => {
        const query = `UPDATE collections SET name = $1, owner_id = $2, description = $3, extra_info = $4 WHERE id = $5`;
        const values = [collection.name, collection.owner_id.value, collection.description, JSON.stringify(collection.extra_info), id.value];
        return DbQueryWithParams(query, values);
    },
    delete_name: async (name: string) => {
        const query = `DELETE FROM collections WHERE name = $1`;
        const values = [name];
        return DbQueryWithParams(query, values);
    },
    delete_id: async (id: UUID) => {
        const query = `DELETE FROM collections WHERE id = $1`;
        const values = [id.value];
        return DbQueryWithParams(query, values);
    }
};

const DBEnd = async () => {
    await dbClient.end();
}

const dataBase = { DBInit, Books_table, DBEnd, Users_table, Collections_table };
export default dataBase;