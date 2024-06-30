// src/components/BookCard/BookCard.js
import React from 'react';
import './BookCard.css';

function BookCard({ title, author, coverImage }) {
    return (
        <div className="book-card">
            <img src={coverImage} alt={`Cover of ${title}`} />
            <div className="book-info">
                <h3>{title}</h3>
                <p>{author}</p>
            </div>
        </div>
    );
}

export default BookCard;
