// src/components/Banner/Banner.js
import React from 'react';
import './Banner.css';

function Banner() {
    return (
        <div className="banner">
            <img src="banner-image.jpg" alt="Banner" />
            <div className="banner-text">
                <h2>Discover New Adventures</h2>
            </div>
        </div>
    );
}

export default Banner;
