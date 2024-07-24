interface UUID {
    value: string;
}

class Book {
    isbn: string;
    title: string;
    authors: string;
    dewey_decimal: string;
    classification: string;
    owner_id: UUID;
    collection_id: UUID;
    extra_info: Record<string, any>;
    constructor(isbn: string, title: string, authors: string, dewey_decimal: string, classification: string, owner_id: UUID, collection_id: UUID, extra_info: Record<string, any>) {
        this.isbn = isbn;
        this.title = title;
        this.authors = authors;
        this.dewey_decimal = dewey_decimal;
        this.classification = classification;
        this.owner_id = owner_id;
        this.collection_id = collection_id;
        this.extra_info = extra_info;
    }
}

class User{
    username: string;
    email: string;
    password: string;
    extra_info: Record<string, any>;
    constructor(username: string, email: string, password: string, extra_info: Record<string, any> = {}) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.extra_info = extra_info
    }
}

class Collection{
    name: string;
    owner_id: UUID;
    description: string;
    extra_info: Record<string, any>;
    constructor(name: string, owner_id: UUID, description: string = '', extra_info: Record<string, any> = {}) {
        this.name = name;
        this.owner_id = owner_id;
        this.description = description;
        this.extra_info = extra_info
    }
}

export { Book, User, Collection };