// src/components/Header/Header.js
import React from 'react';
import './Header.css';

function Header() {
    return (
        <header className="header">
            <h1 className="logo">Character & Reading</h1>
            <nav className="main-nav">
                <ul>
                    <li><a href="#home">Home</a></li>
                    <li><a href="#about">About Us</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </nav>
            <div className="search-bar">
                <input type="text" placeholder="Search..." />
                <button type="submit">Search</button>
            </div>
        </header>
    );
}

export default Header;
