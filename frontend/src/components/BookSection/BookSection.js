// src/components/BookSection/BookSection.js
import React from 'react';
import BookCard from '../BookCard/BookCard';
import './BookSection.css';

function BookSection({ title, books }) {
    return (
        <section className="book-section">
            <h2>{title}</h2>
            <div className="book-list">
                {books.map(book => (
                    <BookCard key={book.id} {...book} />
                ))}
            </div>
        </section>
    );
}

export default BookSection;
