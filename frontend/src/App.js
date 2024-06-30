// import logo from './logo.svg';
// import './App.css';

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Hello, World! This is a React app running on Docker container.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;
// src/App.js
import React from 'react';
import Header from './components/Header/Header';
import Banner from './components/Banner/Banner';
import BookSection from './components/BookSection/BookSection';
import Footer from './components/Footer/Footer';
import './App.css';

function App() {
    const newReleases = [
        { id: 1, title: "Fantasy Island", author: "John Doe", coverImage: "url_to_image.jpg" },
        // 更多书籍...
    ];

    return (
        <div className="App">
            <Header />
            <Banner />
            <BookSection title="New Releases" books={newReleases} />
            <Footer />
        </div>
    );
}

export default App;
