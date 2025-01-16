-- 插入 publisher 表格的資料
INSERT INTO publisher (publisher_id, publisher_name) 
VALUES 
(1, 'Penguin Random House'),
(2, 'HarperCollins'),
(3, 'Simon & Schuster');

-- 插入 book_language 表格的資料
INSERT INTO book_language (language_id, language_code, language_name) 
VALUES 
(1, 'EN', 'English'),
(2, 'ES', 'Spanish'),
(3, 'FR', 'French');

-- 插入 book 表格的資料
INSERT INTO book (book_id, title, isbn13, language_id, num_pages, publication_date, publisher_id) 
VALUES 
(1, 'The Great Adventure', '978-1234567890', 1, 350, '2024-01-01', 1),
(2, 'The Mystery of Forest', '978-0987654321', 2, 200, '2023-05-10', 2),
(3, 'Journey to the Unknown', '978-1122334455', 3, 300, '2022-08-15', 3);

-- 插入 author 表格的資料
INSERT INTO author (author_id, author_name) 
VALUES 
(1, 'John Doe'),
(2, 'Jane Smith'),
(3, 'Emily Johnson');

-- 插入 book_author 表格的資料 (多對多關聯)
INSERT INTO book_author (book_id, author_id) 
VALUES 
(1, 1), 
(2, 2),
(3, 3);

-- 插入 customer 表格的資料
INSERT INTO customer (customer_id, first_name, last_name, email) 
VALUES 
(1, 'Alice', 'Brown', 'alice.brown@example.com'),
(2, 'Bob', 'White', 'bob.white@example.com'),
(3, 'Charlie', 'Green', 'charlie.green@example.com');

-- 插入 country 表格的資料
INSERT INTO country (country_id, country_name) 
VALUES 
(1, 'USA'),
(2, 'Spain'),
(3, 'France');

-- 插入 address 表格的資料
INSERT INTO address (address_id, street_number, street_name, city, country_id) 
VALUES 
(1, '123', 'Main St', 'New York', 1),
(2, '456', 'Elm St', 'Madrid', 2),
(3, '789', 'Pine St', 'Paris', 3);

-- 插入 address_status 表格的資料
INSERT INTO address_status (status_id, address_status) 
VALUES 
(1, 'Active'),
(2, 'Inactive');

-- 插入 customer_address 表格的資料 (多對多關聯)
INSERT INTO customer_address (customer_id, address_id, status_id) 
VALUES 
(1, 1, 1),
(2, 2, 1),
(3, 3, 2);

-- 插入 shipping_method 表格的資料
INSERT INTO shipping_method (method_id, method_name, cost) 
VALUES 
(1, 'Standard Shipping', 5),
(2, 'Express Shipping', 10),
(3, 'Overnight Shipping', 15);

-- 插入 cust_order 表格的資料
INSERT INTO cust_order (order_id, order_date, customer_id, shipping_method_id, dest_address_id) 
VALUES 
(1, '2025-01-01 10:00:00', 1, 1, 1),
(2, '2025-01-02 14:00:00', 2, 2, 2),
(3, '2025-01-03 09:00:00', 3, 3, 3);

-- 插入 order_status 表格的資料
INSERT INTO order_status (status_id, status_value) 
VALUES 
(1, 'Pending'),
(2, 'Shipped'),
(3, 'Delivered');

-- 插入 order_history 表格的資料
INSERT INTO order_history (history_id, order_id, status_id, status_date) 
VALUES 
(1, 1, 1, '2025-01-01'),
(2, 2, 2, '2025-01-02'),
(3, 3, 3, '2025-01-03');

-- 插入 order_line 表格的資料
INSERT INTO order_line (line_id, order_id, book_id, price) 
VALUES 
(1, 1, 1, 20),
(2, 2, 2, 15),
(3, 3, 3, 25);
