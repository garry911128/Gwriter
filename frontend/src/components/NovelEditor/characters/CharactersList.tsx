import React from 'react';

interface Character {
  id: string;
  name: string;
  description: string;
  role: string;
}

interface CharactersListProps {
  characters: Character[];
  isDarkMode: boolean;
}

const CharactersList: React.FC<CharactersListProps> = ({ characters, isDarkMode }) => (
  <div>
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
        <i className="bi bi-people me-2" style={{ color: '#e74c3c' }}></i>
        角色卡
      </h6>
      <button className="btn btn-success btn-sm" style={{ borderRadius: '10px' }}>
        <i className="bi bi-plus"></i>
      </button>
    </div>
    {characters.map((character) => (
      <div
        key={character.id}
        className="character-item p-3 mb-2 rounded-3"
        style={{
          background: isDarkMode ? 'rgba(231, 76, 60, 0.2)' : 'rgba(231, 76, 60, 0.1)',
          border: `1px solid ${isDarkMode ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.2)'}`,
          cursor: 'pointer'
        }}
      >
        <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>{character.name}</div>
        <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>{character.role}</div>
        <div className={`small mt-1 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>{character.description}</div>
      </div>
    ))}
  </div>
);

export default CharactersList;
