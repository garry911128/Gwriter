-- 創建 publisher 表格
CREATE TABLE publisher (
    publisher_id INT PRIMARY KEY,
    publisher_name VARCHAR(255) NOT NULL
);

-- 創建 book 表格
CREATE TABLE book (
    book_id INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    isbn13 VARCHAR(20),
    language_id INT,
    num_pages INT,
    publication_date DATE,
    publisher_id INT,
    FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id)
);

-- 創建 author 表格
CREATE TABLE author (
    author_id INT PRIMARY KEY,
    author_name VARCHAR(255) NOT NULL
);

-- 創建 book_author 表格（多對多關聯）
CREATE TABLE book_author (
    book_id INT,
    author_id INT,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id),
    FOREIGN KEY (author_id) REFERENCES author(author_id)
);

-- 創建 book_language 表格
CREATE TABLE book_language (
    language_id INT PRIMARY KEY,
    language_code VARCHAR(10),
    language_name VARCHAR(50)
);

-- 創建 customer 表格
CREATE TABLE customer (
    customer_id INT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100)
);

-- 創建 address_status 表格
CREATE TABLE address_status (
    status_id INT PRIMARY KEY,
    address_status VARCHAR(50)
);

-- 創建 country 表格
CREATE TABLE country (
    country_id INT PRIMARY KEY,
    country_name VARCHAR(100)
);

-- 創建 address 表格
CREATE TABLE address (
    address_id INT PRIMARY KEY,
    street_number VARCHAR(50),
    street_name VARCHAR(255),
    city VARCHAR(100),
    country_id INT,
    FOREIGN KEY (country_id) REFERENCES country(country_id)
);

-- 創建 customer_address 表格（多對多關聯）
CREATE TABLE customer_address (
    customer_id INT,
    address_id INT,
    status_id INT,
    PRIMARY KEY (customer_id, address_id),
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY (address_id) REFERENCES address(address_id),
    FOREIGN KEY (status_id) REFERENCES address_status(status_id)
);

-- 創建 shipping_method 表格
CREATE TABLE shipping_method (
    method_id INT PRIMARY KEY,
    method_name VARCHAR(100),
    cost INT
);

-- 創建 cust_order 表格
CREATE TABLE cust_order (
    order_id INT PRIMARY KEY,
    order_date DATETIME,
    customer_id INT,
    shipping_method_id INT,
    dest_address_id INT,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY (shipping_method_id) REFERENCES shipping_method(method_id),
    FOREIGN KEY (dest_address_id) REFERENCES address(address_id)
);

-- 創建 order_status 表格
CREATE TABLE order_status (
    status_id INT PRIMARY KEY,
    status_value VARCHAR(50)
);

-- 創建 order_history 表格
CREATE TABLE order_history (
    history_id INT PRIMARY KEY,
    order_id INT,
    status_id INT,
    status_date DATE,
    FOREIGN KEY (order_id) REFERENCES cust_order(order_id),
    FOREIGN KEY (status_id) REFERENCES order_status(status_id)
);

-- 創建 order_line 表格
CREATE TABLE order_line (
    line_id INT PRIMARY KEY,
    order_id INT,
    book_id INT,
    price INT,
    FOREIGN KEY (order_id) REFERENCES cust_order(order_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id)
);
